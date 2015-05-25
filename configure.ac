AC_INIT([QJS], [0.0.0])
AM_INIT_AUTOMAKE([1.11 -Wall foreign dist-xz no-dist-gzip])
AM_SILENT_RULES([yes])

# Check for programs we need during build

AC_PROG_MKDIR_P
PKG_PROG_PKG_CONFIG

AC_MSG_CHECKING([for GJS])
AS_IF([pkg-config --exists gjs-1.0], [
    GJS_PATH=`pkg-config --variable=gjs_console gjs-1.0`
    AC_MSG_RESULT([$GJS_PATH])
], [
    gjs_pc_file=no
    AC_MSG_RESULT([pkg-config file not found, will try to guess])
])
AS_IF([test "x$gjs_pc_file" = xno],
    [AC_PATH_PROG([GJS_PATH], [gjs], [notfound])])
AS_IF([test "x$GJS_PATH" = xnotfound],
    [AC_MSG_ERROR([You need GJS to install QJS!])])
AC_SUBST([GJS_PATH])

# Output build system

AC_CONFIG_FILES([Makefile])
AC_OUTPUT
