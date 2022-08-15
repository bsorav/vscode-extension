
## Clone the Repo
- cd $(HOME) && git clone https://github.com/bsorav/vscode-extension
  - The extension currently assumes that the repository is checked out in the home directory of the current user.
- Since running locally clone the repo in the same folder as `superopt-project`.

## Installing Dependencies
- Install node v16
- sudo npm install -g yo generator-code
- cd /path/to/vscode-extension
- Run `npm i` for installing the required node modules. 

## Running the Extension locally
- Open /path/to/vscode-extension in VSCode
- Press F5 to open a new VSCode window that is running our extension
- Press `ctrl+shift+P` to open command pallete.
- Select `Check Equivalence` command to run the `eq32` command. Select `src` and `dst` file in the file picker.
- Notification shown when proof is completed.
- Again press `ctrl+shift+P` to open command pallete and then select `Visulaize Proof` command to create visualization of proof.

## Code Details
- src/extension.ts
    - Contains the activation code for extension.
    - `activate` function adds `Check Equivalence` and `Visulaize Proof` commands to command pallete. 
    - `Check Equivalence` commands takes src code file and dst code file as input. It runs the `eq32` command on src and dst file. The code files, logs and generated proof file is added to `/equivalence-checker/eq_check_out/` dir. 
        - `eq32` command is run from the `home` dir. 
        - This command's code has hardcoded `equivalence-checker` dir path. 
    - `Visualize Proof` reads file from the `/equivalence-checker/eq_check_out/` dir and creates visualization. 
