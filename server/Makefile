# Add the HOST and PORT details below.
FILE_PATH = "../eqchecker/src/web/extension.ts"
HOST = "https://localhost"
PORT = "3000"

run::
	sed -i "0,/^const defaultServerURL =/s|const defaultServerURL = .*|const defaultServerURL = '${HOST}:${PORT}'|" "${FILE_PATH}"
	node app.js --host ${HOST} --port ${PORT} --superoptInstall ${HOME}/superopt-project/usr/local --tmpDir /tmp  
