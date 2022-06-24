export function parseDOTString(fileString)
{
    const lines = fileString.match(/\".*\]/g);
    var nodes = [];
    var edges = [];
    var done = [];

    lines.forEach(element => {
        var temp = element.split(/\->|\[label=\"|\"\]/);
        
        var node1 = temp[0].substring(1, temp[0].length-1);
        var node2 = temp[1].substring(1, temp[1].length-1);
        var label = temp[2].substring(0, temp[2].length-2);
        
        var id1, id2;
        if(!done.includes(node1)){
            done.push(node1);
            id1 = done.length-1;
            nodes.push({id:id1, label:node1});
        }else{
            id1 = done.indexOf(node1);
        }

        if(!done.includes(node2)){
            done.push(node2);
            id2 = done.length-1;
            nodes.push({id:id2, label:node2});
        }else{
            id2 = done.indexOf(node2);
        }
        // console.log({from:[id1, done[id1]], to:[id2, done[id2]],});
        edges.push({from:node1, to:node2, condition:label, statement:label});
    });
    
    return {nodes:done, edges:edges};
}