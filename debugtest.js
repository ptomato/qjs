const Lang = imports.lang;
const Q = imports.q;

const MyClass = new Lang.Class({
    Name: 'MyClass',

    _initialValue: 5,
    myMethod: function (foo, bar) {
        let buffer = [];
        Q.time(buffer, 'map');
        for (let count = 0; count < foo; count++) {
            buffer.push(this._initialValue);
        }
        return buffer.map((item) => item * bar);
    },

    myRecursiveMethod: function (foo) {
        if (foo < 1)
            return 1;
        return foo * this.myRecursiveMethod(foo - 1);
    },
});

let obj = new MyClass();
// Q.DEBUG = false;  // uncomment to turn off debugging
Q.trace(obj, 'myRecursiveMethod');
Q.trace(obj, 'myMethod');
Q.time(obj, 'myMethod');
// Q.breakBefore('print');  // run under gdb or lldb to see breakpoints
print(obj.myMethod(17355, 57291)[0]);
print(obj.myRecursiveMethod(5));
