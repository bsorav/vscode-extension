HOSTNAME=proton.cse.iitd.ac.in
PORT=8080
SMT_SOLVER_TMP_FILES_DIR=${HOME}/vscode-server-files #/nfs/sbansal
SUPEROPT_INSTALL_DIR=${HOME}/viraj/superopt-project/usr/local
USE_HTTPS=false #true
SSL_PRIVKEY=#/etc/letsencrypt/live/vayu.cse.iitd.ac.in/privkey.pem
SSL_CERT=#/etc/letsencrypt/live/vayu.cse.iitd.ac.in/fullchain.pem
CHECK_LOGIN=false #true
DEFAULT_EQCHECK_QUOTA=10000 #10

run::
	USE_HTTPS=$(USE_HTTPS) SSL_PRIVKEY=$(SSL_PRIVKEY) SSL_CERT=$(SSL_CERT) HOSTNAME=$(HOSTNAME) PORT=$(PORT) SMT_SOLVER_TMP_FILES_DIR=$(SMT_SOLVER_TMP_FILES_DIR) CHECK_LOGIN=$(CHECK_LOGIN) DEFAULT_EQCHECK_QUOTA=$(DEFAULT_EQCHECK_QUOTA) node app.js --host $(HOSTNAME) --port $(PORT) --superoptInstall $(SUPEROPT_INSTALL_DIR) --tmpDir $(SMT_SOLVER_TMP_FILES_DIR)

allow_access::
	sudo setcap CAP_NET_BIND_SERVICE=+eip ${HOME}/.nvm/versions/node/v18.16.0/bin/node