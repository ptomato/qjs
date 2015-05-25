EXTRA_DIST =
CLEANFILES =

# Executable

dist_bin_SCRIPTS = bin/qjs

do_subst = sed \
	-e 's,[@]pkgdatadir[@],$(pkgdatadir),g' \
	-e 's,[@]GJS_PATH[@],$(GJS_PATH),g' \
	$(NULL)
bin/qjs: bin/qjs.in Makefile
	$(AM_V_GEN)$(MKDIR_P) bin && \
	$(do_subst) < $< > $@ && \
	chmod +x $@
EXTRA_DIST += bin/qjs.in
CLEANFILES += bin/qjs

# Source code

dist_pkgdata_DATA = \
	src/q.js \
	$(NULL)

# Tests

EXTRA_DIST += test/smoke/example.js

# Git ignore files

MAINTAINERCLEANFILES = $(GITIGNORE_MAINTAINERCLEANFILES_TOPLEVEL)

-include $(top_srcdir)/git.mk
