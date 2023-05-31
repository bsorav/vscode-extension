HOSTNAME=vayu.cse.iitd.ac.in
PORT=80
SMT_SOLVER_TMP_FILES_DIR=/nfs/sbansal
SUPEROPT_INSTALL_DIR=${HOME}/superopt-project/usr/local
USE_HTTPS=true
SSL_PRIVKEY=/etc/letsencrypt/live/vayu.cse.iitd.ac.in/privkey.pem
SSL_CERT=/etc/letsencrypt/live/vayu.cse.iitd.ac.in/fullchain.pem

run::
	USE_HTTPS=$(USE_HTTPS) SSL_PRIVKEY=$(SSL_PRIVKEY) SSL_CERT=$(SSL_CERT) HOSTNAME=$(HOSTNAME) SMT_SOLVER_TMP_FILES_DIR=$(SMT_SOLVER_TMP_FILES_DIR) node app.js --host $(HOSTNAME) --port $(PORT) --superoptInstall $(SUPEROPT_INSTALL_DIR) --tmpDir $(SMT_SOLVER_TMP_FILES_DIR)

allow_access::
	sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/node
	sudo setcap CAP_NET_BIND_SERVICE=+eip ${HOME}/.nvm/versions/node/v19.7.0/bin/node
