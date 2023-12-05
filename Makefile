SUPEROPT_PROJECT_DIR ?= $(realpath $(CURDIR)/..)
NODE=node-v20.3.1-linux-x64

.PHONY: server_install_modules
server_install_modules:
	cd server && npm i && cd ..
	cd scripts/ && npm i && cd ..
	chmod +x scripts/upload-eqcheck

.PHONY: client_install_modules
client_install_modules:
	cd eqchecker && npm i && cd ..

.PHONY: client_package
	cd eqchecker && vsce package && cd ..

.PHONY: node_install
node_install:
	cd /tmp && tar xf $(SUPEROPT_PROJECT_DIR)/tars/$(NODE).tar.xz && sudo cp -rf $(NODE)/lib $(NODE)/share $(NODE)/include $(NODE)/bin /usr

.PHONY: distclean
distclean:
	git clean -df
