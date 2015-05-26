const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Format = imports.format;
const Lang = imports.lang;
const System = imports.system;

String.prototype.format = Format.format;

let _breakpoints = 0;

let _tmpdir = GLib.getenv('TMPDIR') || GLib.getenv('TEMP') || '/tmp';
let _outputFile = Gio.File.new_for_path(_tmpdir).get_child('q');
let _startTime;
// Using replace() will try to write the file atomically using a temporary file.
// So instead, delete and create.
try {
    _outputFile.delete(null);
} catch (e) {
    // ignore error
}
let _stream = _outputFile.create(Gio.FileCreateFlags.REPLACE_DESTINATION, null);

function write() {
    let string = Array.join(arguments, ' ');
    let now = GLib.get_monotonic_time();
    let prefix = '%4.1fs '.format(((now - _startTime) / 1e6) % 100);
    let output = prefix + string + '\n';
    _stream.write(output, null);
}

// Return an array of stack frames (strings as printed by GJS) corresponding to
// the point where _getCurrentStack() was called
function _getCurrentStack() {
    let e = new Error();
    let stack = e.stack.split('\n');
    stack.pop();  // remove last newline
    stack.shift();  // remove _getCurrentStack's own frame
    return stack;
}

// Return [function name, file name, line number] for a stack frame (i.e. a
// string as printed by GJS, as returned from _getCurrentStack())
function _interpretStackFrame(frame) {
    let [location, fileLine] = frame.split('@');
    let [file, line] = fileLine.split(':');
    if (location === '')
        location = 'anonymous function';
    return [location, file, line];
}

// This is how trace(), time(), etc. are actually implemented, since they are
// pretty much all the same except for the decorator
function _decorate(name, decorator, args) {
    if (args.length < 1 || args.length > 2)
        throw new TypeError(name + '() takes one or two arguments');

    let scope, ident;

    if (args.length === 1) {
        if (typeof args[0] === 'function')
            return decorator(args[0]);
        scope = window;
        ident = args[0];
    } else {
        scope = args[0];
        ident = args[1];
    }

    scope[ident] = decorator(scope[ident], ident);
    return scope[ident];
}

// inspired by Python's functools.wraps
// A decorator function has the following properties:
// - isDecorator: true
// - wraps: the inner function (may be another decorator)
// - decoratedFunc: the innermost function, inside of all decorators
// Additionally, a decorator function gives the inner function it wraps a
// "wrapper" property, pointing to the decorator
function _makeDecorator(innerFunc, decoratorFunc, otherProperties) {
    decoratorFunc.isDecorator = true;
    if (innerFunc.isDecorator) {
        innerFunc.wrapper = decoratorFunc;
        decoratorFunc.decoratedFunc = innerFunc.decoratedFunc;
    } else {
        decoratorFunc.decoratedFunc = innerFunc;
    }
    decoratorFunc.wraps = innerFunc;
    // decoratorFunc.name = innerFunc.name;  // "name" is read-only :-(
    Lang.copyProperties(otherProperties, decoratorFunc);
    return decoratorFunc;
}

// Returns whether @func, or any functions that @func decorates if it is a
// decorator, has a "tag" property equal to @tag.
function _isDecoratedWithTag(func, tag) {
    for (; func.isDecorator; func = func.wraps) {
        if (func.tag === tag)
            return true;
    }
    return false;
}

function _prettyPrint(obj) {
    let retval = JSON.stringify(obj);
    if (retval.length > 15)
        retval = retval.substr(0, 12) + '...';
    if (obj.length !== undefined)
        retval += ' (length ' + obj.length + ')';
    return retval;
}

// Decorates a function so that it prints information when it starts and ends.
// If @funcName is not given, this will attempt to find @func's name through the
// "name" property, and if that fails, it will be called 'anonymous function'.
// The trace() function will attach this decorator to an existing function.
function _traceDecorator(func, funcName) {
    if (!DEBUG || _isDecoratedWithTag(func, 'trace'))
        return func;
    if (funcName === undefined)
        funcName = func.name || 'anonymous function';

    return _makeDecorator(func, function () {
        let depth = ++arguments.callee.recursionDepth;
        let traceString = (funcName +
            '(' + Array.map(arguments, _prettyPrint).join(', ') + ')');
        if (depth > 1)
            traceString += ' [' + depth + ']';
        write('Entering', traceString);
        let retval = func.apply(this, arguments);
        write('Leaving', traceString, '->', _prettyPrint(retval));
        arguments.callee.recursionDepth--;
        return retval;
    }, {
        recursionDepth: 0,
        tag: 'trace',
    });
}

// Decorates a function so that it prints out timing information. The time()
// function will attach this decorator to an existing function. See also
// _traceDecorator().
function _timeDecorator(func, funcName) {
    if (!DEBUG || _isDecoratedWithTag(func, 'time'))
        return func;
    if (funcName === undefined)
        funcName = func.name || 'anonymous function';

    return _makeDecorator(func, function () {
        let timer = GLib.get_monotonic_time();
        let retval = func.apply(this, arguments);
        let time = GLib.get_monotonic_time() - timer;
        write(funcName, 'executed in', time, 'microseconds');
        return retval;
    }, {
        tag: 'time',
    });
}

// Decorates a function so that it has a breakpoint before it starts. The
// breakBefore() function will attach this decorator to an existing function.
// See also _traceDecorator().
function _breakBeforeDecorator(func) {
    if (!DEBUG || _isDecoratedWithTag(func, 'breakBefore'))
        return func;

    return _makeDecorator(func, function () {
        write('Breakpoint', arguments.callee.breakpointNum, 'reached');
        System.breakpoint();
        return func.apply(this, arguments);
    }, {
        breakpointNum: ++_breakpoints,
        tag: 'breakBefore',
    });
}

// PUBLIC API

/**
 * DEBUG:
 *
 * Defaults to true. Set to false at the beginning of your program to disable
 * all debugging commands.
 */
var DEBUG = true;

/**
 * trace:
 *
 * Put a trace on a function.
 * The trace will print out a message when the function is called (mentioning
 * its arguments and its recursion depth) and when it returns (mentioning its
 * return value.)
 *
 * trace() and the other similar functions can be called in three forms.
 *
 * # Q.trace(function)
 * Puts a trace on the given function and returns the modified function; useful
 * when amending the function's original definition.
 *
 * # Q.trace('identifier')
 * Puts a trace on a function named `identifier` in the global scope; useful for
 * tracing a built-in function such as `print`.
 *
 * # Q.trace(object, 'identifier')
 * Puts a trace on the function `object.identifier`.
 *
 * Examples:
 *
 *     let myObj = {
 *         myMethod: Q.trace(function (args) {
 *             // do stuff
 *         }),
 *         myOtherMethod: function (args) {
 *             // do stuff
 *         },
 *     };
 *     Q.trace(myObj, 'myOtherMethod');
 *     Q.trace('print');
 *     let myArray = [];
 *     Q.trace(myArray, 'push');
 *
 * Returns: the decorator function
 */
function trace() {
    return _decorate('trace', _traceDecorator, arguments);
}

/**
 * time:
 *
 * Time how long a function takes to execute.
 * The function will print out a message on return, saying how long the function
 * took to execute.
 * See trace() for examples of how to use this function.
 *
 * Returns: the decorator function
 */
function time() {
    return _decorate('time', _timeDecorator, arguments);
}

/**
 * breakBefore:
 *
 * Set a System.breakpoint() before a function executes.
 * The breakpoint will abort the program unless run under a debugger such as
 * GDB, so be careful.
 * See trace() for examples of how to use this function.
 *
 * Returns: the decorator function
 */
function breakBefore(ident, scope) {
    return _decorate('breakBefore', _breakBeforeDecorator, arguments);
}

/**
 * q:
 * @value: Value to pretty-print.
 *
 * Prints out @value on the terminal.
 *
 * Returns: @value
 */
function q(value) {
    if (!DEBUG)
        return value;
    let [func, file, line] = _interpretStackFrame(_getCurrentStack()[1]);
    write(file + ':' + line + ': ' + _prettyPrint(value));
    return value;
}

// Load all the module's API as properties onto the q() function and set that
// that as the Q module object.
q.trace = trace;
q.time = time;
q.breakBefore = breakBefore;
Object.defineProperty(q, 'DEBUG', {
    get: function () { return DEBUG; },
    set: function (value) { DEBUG = value; },
    enumerable: true,
    configurable: true,
});
imports.q = q;
_startTime = GLib.get_monotonic_time();
