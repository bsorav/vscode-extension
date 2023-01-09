host::
	#screen -S npx -d -m bash -c 'npx serve --cors -l 5000; exec sh'
	-bash -c 'npx serve --cors -l 5000 >& npx.out' &
	npx localtunnel -p 5000
	#screen -S npx -X quit
