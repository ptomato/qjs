# QJS #

Quick and dirty debugging output for tired GJS programmers.

Inspired by the [q](https://github.com/zestyping/q) Python module, QJS
gives you just that little bit more than debug print statements on a
platform with a conspicuous lack of debugging tools.
(Which is why GJS programmers are more tired than Python programmers.)

## To use ##

```js
const Q = imports.q;
```
Launch your program with `qjs` instead of `gjs` to make sure you
have the right search path for modules.

All output goes to `/tmp/q`, which you can watch with this shell
command:
```sh
tail -f /tmp/q
```
If `$TMPDIR` is set, the output goes to `$TMPDIR/q`.

### q() ###

To print the value of `foo`:
```js
Q(foo);  // can also be used in the middle of an expression
```

### trace() ###

To trace a function's arguments and return value, add this:
```js
Q.trace('functionName');
Q.trace(myObject, 'methodName');
```

Or surround its definition with `Q.trace()`:
```js
myMethod: Q.trace(function (args) {
    // do something with args
}),
```

### time(), breakBefore() ###

`Q.time()` reports your function's execution time.
`Q.breakBefore()` sets a debugger breakpoint when the function starts.
These functions work the same as `Q.trace()`.

Be careful with `Q.breakBefore()`; if you're not running under a
debugger such as `gdb` or `lldb`, then your program will terminate with
SIGTRAP.

### DEBUG ###

Set `Q.DEBUG` to `false` to disable QJS's features.

## Support ##

Please file issues here at [GitHub](https://github.com/ptomato/qjs).

Copyright (c) 2015 Philip Chimento.
