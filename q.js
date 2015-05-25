const GLib = imports.gi.GLib;
const Lang = imports.lang;
const System = imports.system;

let _breakpoints = 0;

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
    let retval = obj.toString();
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
        printerr('Entering', traceString);
        let retval = func.apply(this, arguments);
        printerr('Leaving', traceString, '->', _prettyPrint(retval));
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
        printerr(funcName, 'executed in', time, 'microseconds');
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
        printerr('Breakpoint', arguments.callee.breakpointNum, 'reached');
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
