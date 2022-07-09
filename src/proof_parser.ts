function parseProofFile(file : string){
    let parsedOutput = {};

    /* 
        PARSE Product Graph
            - Get all nodes
            - Get all edges
            - Rename nodes with row,col
            - Parse the correlated paths in required format
    */

    let productGraph = {};
    let productGraphNodes = [];
    let productGraphEdges = [];
    let srcGraphNodesMap = {};
    let dstGraphNodesMap = {};

    productGraphNodes = getGraphNodes("product", file);
    productGraphEdges = getGraphEdges("product", file);

    productGraph = {"nodes": productGraphNodes, "edges": productGraphEdges};

    srcGraphNodesMap = getSrcNodesMap(file);

    let res = formatProductGraphEdges(productGraph, srcGraphNodesMap);

    productGraph = res["productGraph"];
    dstGraphNodesMap = res["dstGraphNodesMap"];

    return productGraph;
}

function getGraphNodes(graph : string, file : string){
    let nodes: string[][] = [];
    let fileLines = file.split('\n');
    
    if(graph === "product"){
        let idx = fileLines.indexOf("=graph_with_guessing") + 1;
        nodes = fileLines[idx].substring(8).split(' ').map((node) => {return node.split("_");});
    }

    return nodes;
}

function getGraphEdges(graph : string, file : string){
    let edges = [];
    let fileLines = file.split('\n');
    
    if(graph === "product"){
        let idx = fileLines.indexOf("=graph_with_guessing") + 3;
        while(fileLines[idx] !== "=graph done"){
            let edge = fileLines[idx].split(" => ");

            let path1Idx = fileLines.indexOf("=Edge: " + fileLines[idx]) + 4;
            let path2Idx = path1Idx + 5;

            edges.push({"from": edge[0], "to": edge[1], "path1": fileLines[path1Idx], "path2": fileLines[path2Idx]});
            idx++;
        }
    }

    return edges;
}


function getSrcNodesMap(file : string){
    let srcNodeMap :{ [id: string] : string; }  = {};

    let fileLines = file.split('\n');
    let idx = fileLines.indexOf("=PC_to_line_and_column:") + 1;
    let end = fileLines.indexOf("=PC_to_line_and_column done");

    while(idx < end){
        let node = fileLines[idx + 1];
        let rc = fileLines[idx + 3].substring(1, fileLines[idx + 3].length - 1).split(" ");
        let line = parseInt(rc[1], 10);
        let col = parseInt(rc[4], 10);

        srcNodeMap[node] = "C_" + line + "_" + col;
        idx += 4;
    }
    return srcNodeMap;
}

function getDstNodesMap(nodesSet : Set<string>){
    let dstNodeMap : {[id : string] : string}= {};

    for(let node of nodesSet){
        let line = parseInt(node.substring(1).split("%")[0]);
        dstNodeMap[node] = "A_" + line;
    }

    return dstNodeMap;
}

function formatProductGraphEdges(productGraph : any, srcGraphNodesMap : any){
    // Formats the correlated path string in edges
    // Formats all nodes in product graph
    // Also returns the set of node in the dst graph
    // console.log(productGraph);

    let dstGraphNodesSet = new Set<string>();
    let productGraphEdges = productGraph["edges"];
    let productGraphNodes = productGraph["nodes"];


    for(let edge of productGraphEdges){
        // console.log(edge);
        let path1 = edge["path1"];
        let path2 = edge["path2"];
        
        let res1 = simplifyPathString(path1);
        let res2 = simplifyPathString(path2);


        edge["path1"] = res1.path;
        edge["path2"] = res2.path;

        res2.nodes.forEach((node) => {dstGraphNodesSet.add(node);});
    }


    let dstGraphNodesMap = getDstNodesMap(dstGraphNodesSet);

    for(let edge of productGraphEdges){
        let path1 = edge["path1"];
        let path2 = edge["path2"];

        let res1 = formatPathString(path1, srcGraphNodesMap);
        let res2 = formatPathString(path2, dstGraphNodesMap);

        edge["path1"] = res1;
        edge["path2"] = res2;
    }

    for(let node of productGraphNodes){
        node[0] = srcGraphNodesMap[node[0]];
        node[1] = dstGraphNodesMap[node[1]];
    }

    productGraph = {"nodes": productGraphNodes, "edges": productGraphEdges};
    let res = {"productGraph": productGraph, "dstGraphNodesMap": dstGraphNodesMap};

    return res;
}

function simplifyPathString(path : string){
    // Simplify the path string to remove unnecessary nodes
    // Convert to required format
    // Returns path and set of nodes in the path

    // console.log(path);

    let newPath = "";
    let nodesSet = new Set<string>();

    let subPaths = splitMultiControlPath(path);

    if(subPaths.length !== 1){
        // console.log(subPaths);
        for(let i = 0; i < subPaths.length; i++){
            let subPath = subPaths[i];
            let res = simplifyPathString(subPath);

            if(res.path === ""){
                continue;
            }
            
            newPath += "(" + res.path + ")" + "+";
            nodesSet = new Set<string>([...nodesSet, ...res.nodes]);
        };
        newPath = "(" + newPath.substring(0, newPath.length - 1) + ")";

        return {path: newPath, nodes: nodesSet};
    }

    subPaths = splitPath(path);

    if(subPaths.length !== 1){
        let last = subPaths[subPaths.length - 1];

        if(splitMultiControlPath(last).length === 1 && splitPath(last).length === 1){
            
            let lastNodes = last.substring(1, last.length - 1).split("=>");

            // return;
            if(applicableNode(lastNodes[1])){
                subPaths.push("(" + lastNodes[1] + "=>cloned" + ")");
            }
        }
    }
    if(subPaths.length !== 1){
        // console.log(subPaths);
        for(let i = 0; i < subPaths.length; i++){
            const subPath = subPaths[i];
            let res = simplifyPathString(subPath);
            
            if(res.path === ""){
                continue;
            }

            newPath += res.path + "-";
            nodesSet = new Set<string>([...nodesSet, ...res.nodes]);
        }
        newPath = newPath.substring(0, newPath.length - 1);
    }
    else{
        // console.log(path);
        let nodes = path.substring(1, path.length - 1).split("=>");

        if(!applicableNode(nodes[0])){
            nodes = [];
        }
        else{
            nodes = [nodes[0]];
        }
        if(nodes.length === 0){
            newPath = "";
        }
        else{
            newPath = nodes[0];
            nodesSet = new Set<string>([...nodes]);
        }
            
    }

    return {path: newPath, nodes: nodesSet};
}

function formatPathString(path : string, nodeMap : any){
    // Map nodes in path to nodeMap values
    
    let newPath = "";

    let idx = 0;

    while(true){
        let res = getNextNode(path.substring(idx));

        if(res === null){
            break;
        }

        let node = res.node;
        let nodeIdx = res.nodeIdx;
        let nodeLen = node.length;

        let newNodeName = "";

        if(node.endsWith("%0")){
            newNodeName = "Z" + nodeMap[node.substring(0, node.length - 2) + "%1"];
        }
        else{
            newNodeName = nodeMap[node];
        }

        newPath += path.substring(idx, nodeIdx) + newNodeName;
        idx += nodeLen;
    }

    return newPath;
}


function isBalanced(s : string){
    let depth = 0;
    
    for(let i = 0; i < s.length; i++){
        if(s[i] === "("){
            depth++;
        }
        else if(s[i] === ")"){
            depth--;
        }
    }

    return depth === 0;
}

function splitMultiControlPath(path : string){
    // Split the multi control path into multiple paths
    // Returns an array of paths

    // Considering path to be "(....)"
    let lis: any[] = [];

    let len = path.length;
    path = path.substring(1, len - 1);
    len -= 2;
    
    let i = 0;
    let depth = 0;
    let p = "";
    while(i < len){
        if(path[i] === "("){
            depth++;
        }
        else if(path[i] === ")"){
            depth--;
        }
        p += path[i];
        i++;

        if(depth === 0 && (i === len || path[i] === "+")){
            lis.push(p);
            p = "";
            i++;
        }
    }
    return lis;
}

function splitPath(path : string){
    // Split the path into series of multiple paths
    // Returns an array of paths

    // Considering path to be "(....)"
    let lis: any[] = [];

    let len = path.length;
    path = path.substring(1, len - 1);
    len -= 2;

    let i = 0;
    let depth = 0;
    let p = "";

    while(i < len){
        if(path[i] === "("){
            depth++;
        }
        else if(path[i] === ")"){
            depth--;
        }
        p += path[i];
        i++;
    
        if(depth === 0 && (i === len || path[i] === "*")){
            lis.push(p);
            p = "";
            i++;
        }
    }

    return lis;    
}

function notClonedNode(node : string){
    return !node.toLowerCase().includes("cloned");
}

function applicableNode(node : string){
    let idx = node.length - 1;
    let num = "";
    while(idx >= 0 && node[idx] !== "%"){
        num = node[idx] + num;
        idx--;
    }
    return notClonedNode(node) && (parseInt(num, 10) === 1 || parseInt(num, 10) === 0);
}

function getNextNode(path : string): any{

    if(path === "" || path === null){
        return null;
    }

    let res = path.match(/[a-z0-9%.]+/i);

    if(res === null){
        return null;
    }

    return {node: res[0], idx: res['index'] };
}

export {parseProofFile};