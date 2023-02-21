# Running the Server

- Edit `server/Makefile` to set the `host` and `port` (currently workstation.cse.iitd.ac.in and 8080
- Run `npm i` to Install required node modules.
- Type `make` inside the `server` directory

# Running the VSCode extension

- Edit `eqchecker/src/web/extension.ts` to set the `defaultServerURL` (based on the host/port you set for the server
- Start VSCode and Open Folder (Ctrl-K Ctrl-O): select the `eqchecker` folder
- Press F5 for "Run and Debug"
  - a new VSCode window will open up that will be running our extension
- In the new window, Press Ctrl-Shift-P and select "Check Equivalence".
  - Then select two Source code files(C and Assembly, or Both C).
