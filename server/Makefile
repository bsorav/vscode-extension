# Add the HOST and PORT details below.
FILE_PATH = "../eqchecker/src/web/extension.ts"
HOST = "workstation.cse.iitd.ac.in"
PORT = "8080"

run::
	sed -i "0,/^const defaultServerURL =/s|const defaultServerURL = .*|const defaultServerURL = 'http://${HOST}:${PORT}'|" "${FILE_PATH}"
	node app.js --host ${HOST} --port ${PORT} --superoptInstall ${HOME}/superopt-project/usr/local --tmpDir /tmp  
