export SUPEROPT_PROJECT_DIR ?= $(PWD)/..
NODE=node-v20.3.1-linux-x64

.PHONY: build
node_install_modules:
	cd server && npm i && cd ..
	cd eqchecker && npm i && cd ..
	cd scripts/ && npm i && cd ..
	chmod +x scripts/upload-eqcheck

.PHONY: node_install
node_install:
	cd /tmp && tar xf $(SUPEROPT_PROJECT_DIR)/tars/$(NODE).tar.xz && sudo cp -rf $(NODE)/lib $(NODE)/share $(NODE)/include $(NODE)/bin /usr

.PHONY: distclean
distclean:
	git clean -df
