run::
	node app.js --host vayu.cse.iitd.ac.in --port 80 --superoptInstall ${HOME}/superopt-project/usr/local --serverInstall ${HOME}/vscode-extension/server --tmpDir /tmp

allow_access::
	-sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/node
	-sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/node
	-sudo setcap CAP_NET_BIND_SERVICE=+eip ${HOME}/.nvm/versions/node/v19.7.0/bin/node
