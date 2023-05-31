run::
	SMT_SOLVER_TMP_FILES_DIR=/nfs/sbansal node app.js --host vayu.cse.iitd.ac.in --port 80 --superoptInstall ${HOME}/superopt-project/usr/local --tmpDir /tmp

allow_access::
	sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/node
	sudo setcap CAP_NET_BIND_SERVICE=+eip ${HOME}/.nvm/versions/node/v19.7.0/bin/node
