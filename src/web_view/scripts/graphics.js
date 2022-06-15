// Contains nodes and edges class

/* Class conatins
        Properties
        function draw()

*/

export class Node {
    static RADIUS = 25;
    static baseLineX;
    static baseLineY; 

    constructor(name, edges, pos, canvas) {
        this.name = name;
        this.edges = edges;
        this.pos = pos; // pos[0] = x; pos[1] = y;
        this.canvas = canvas;
    }

    draw() {
        // Circle
        this.canvas.strokeStyle = 'black';
        this.canvas.fillStyle = 'rgba(0,0,0,0.1)';
        this.canvas.lineWidth = 2;
 
        this.canvas.beginPath();
        this.canvas.arc(this.pos[0], this.pos[1], Node.RADIUS, 0, 2 * Math.PI);

        this.canvas.stroke();
        this.canvas.fill();

        // Text
        this.canvas.font = '12px serif';
        this.canvas.fillStyle = 'rgba(0,0,0,1)';
        this.canvas.textAlign = "center";
        this.canvas.textBaseline = "middle";
        this.canvas.fillText(this.name, this.pos[0], this.pos[1]);
    }
}

export class Edge {
    lineWidth = 2;

    constructor(from, to, line1, line2, canvas) {
        this.from = from;
        this.to = to;
        this.line1 = line1;
        this.line2 = line2;
        this.back_edge = false;
        this.canvas = canvas;
        this.pos = [];
    }

    draw() {
        this.canvas.strokeStyle = 'red';
        this.canvas.lineWidth = this.lineWidth;

        // draw a red line

        var x1 = this.from.pos[0];
        var y1 = this.from.pos[1];

        var x2 = this.to.pos[0];
        var y2 = this.to.pos[1];

        if (this.back_edge)
        {
            if (y1 > Node.baseLineY)
            {
                var loc = -1;
            }
            else
            {
                var loc = 1;
            }
            var m1 = -1*(x2-x1)/(y2-y1);

            var coord1 = coordAtDist(x1, y1, m1, loc*Node.RADIUS);
            var coord2 = coordAtDist(x2, y2, m1, loc*Node.RADIUS);

            var dist = Math.sqrt((coord1.x - coord2.x)**2 + (coord1.y - coord2.y)**2);
            dist = Math.tan(Math.PI/3)*dist/2;
            var c1 = {x: (coord1.x + coord2.x)/2, y:(coord1.y + coord2.y)/2};

            
            var c2 = coordAtDist(c1.x, c1.y, m1, -1*loc*dist);

            var theta1 = Math.atan((coord1.y - c2.y)/(coord1.x - c2.x));
            var theta2 = Math.atan((coord2.y - c2.y)/(coord2.x - c2.x));
            var r = Math.sqrt((coord1.x - c2.x)**2 + (coord1.y - c2.y)**2);

            if (loc === -1)
            {
                theta1 = Math.PI + theta1;
                theta2 = Math.PI + theta2;
            }

            this.canvas.beginPath();
            this.canvas.arc(c2.x, c2.y, r, theta2, theta1, loc ? true : false);
            this.canvas.stroke();

            var dir = (coord2.y - c2.y)/(coord2.x - c2.x);
            drawArrowHead(coord2.x, coord2.y, -1/dir, 1, this.canvas);

        }
        else
        {
            var m1 = (y2-y1)/(x2-x1);
            var coord1 = coordAtDist(x1, y1, m1, Node.RADIUS);
            var coord2 = coordAtDist(x2, y2, m1, -1*Node.RADIUS);

            this.canvas.beginPath();
            this.canvas.moveTo(coord1.x, coord1.y);
            this.canvas.lineTo(coord2.x, coord2.y);
            this.canvas.stroke();
            drawArrowHead(coord2.x, coord2.y, m1, -1, this.canvas);
        }
         
    }

    hovering(x, y)
    {
        var x1 = this.pos[0];
        var y1 = this.pos[1];

        var x2 = this.pos[2];
        var y2 = this.pos[3];
        if (x1 <= x2 && x >= x1 && x <= x2)
        {
            if (y1 <= y2 && y >= y1 && y <= y2)
            {
                return true;
            }
            if (y1 >= y2 && y >= y2 && y<= y1 )
            {
                return true;
            }
        }
        if (x1 >= x2 && x >= x2 &&  x <= x1)
        {
            if (y1 <= y2 && y >= y1 && y <= y2)
            {
                return true;
            }
            if (y1 >= y2 && y >= y2 && y<= y1 )
            {
                return true;
            }
        }
        return false;
    }
}


function drawArrowHead(x, y, dir, back, canvas)
{ 
    var len = 8;
    var baseHalf = len*Math.sin(Math.PI/4);

    var normal = -1/dir;

    var baseCen = coordAtDist(x, y, dir, back*baseHalf);

    var coord1 = coordAtDist(baseCen.x, baseCen.y, normal, baseHalf);
    var coord2 = coordAtDist(baseCen.x, baseCen.y, normal, -1*baseHalf);


    canvas.fillStyle = 'rgba(255,0,0,1)';

    canvas.beginPath();
    canvas.moveTo(coord1.x, coord1.y);
    canvas.lineTo(coord2.x, coord2.y);
    canvas.lineTo(x, y);
    canvas.fill();
    // canvas.stroke();
}

export function instantiateNodes(num_nodes, adj_lis, canvas)
{
    const RADIUS = 25;
    const MARGIN = 50;
    const GAP = 50;


    // BFS variables
    var visited = new Array(num_nodes).fill(0);
    var level = new Array(num_nodes).fill(0); // Level of node in BFS tree of CFG (Here level is in x dir)

    var parent = new Array(num_nodes).fill(-1); // Parent of node in BFS tree.

    var queue = [0];
    parent[0] = 0;

    var maxLevel = 0; // Max Level is maximum depth of BFS tree

    while (queue.length !== 0)
    {
        var node = queue.shift();
        
        visited[node] = 1;
        
        for (let i = 0; i < adj_lis[node].length; i++) {
            const element = adj_lis[node][i];
            
            if(visited[element]){
                continue;
            }
            
            level[element] =  1 + level[node];
            maxLevel = Math.max(level[element], maxLevel);
            queue.push(element);  
            
            if (parent[element] === -1)
            {
                parent[element] = node;
            }
        }
        
    }

    var numNodesOnLevel = new Array(maxLevel + 1).fill(0); // Number of nodes on each level

    for (let i = 0; i < level.length; i++) {
        const element = level[i]; 
        numNodesOnLevel[element] += 1;    
    }

    var maxWidth = 0; // Maximum number of nodes in a level the BFS tree.

    for (let i = 0; i < numNodesOnLevel.length; i++) {
        const element = numNodesOnLevel[i];
        maxWidth = Math.max(maxWidth, element);
    }

    // // Canvas element on html page
    var canvas = document.getElementById('canvas');

    // // Setting canvas hight and width according to cfg's  maximum width and maximum height 
    canvas.width = Math.max(window.innerWidth, 2*MARGIN + (maxLevel+1)*2*RADIUS + (maxLevel)*GAP);
    canvas.height = Math.max(window.innerHeight, 2*MARGIN + maxWidth*2*RADIUS + (maxWidth-1)*GAP);

    const CANVAS_WIDTH = Math.max(window.innerWidth, 2*MARGIN + (maxLevel+1)*2*RADIUS + (maxLevel)*GAP);
    const CANVAS_HEIGHT = Math.max(window.innerHeight, 2*MARGIN + maxWidth*2*RADIUS + (maxWidth-1)*GAP);

    // // canvas variable to draw 2d objects
    canvas = canvas.getContext('2d');

    var baseLineY  = Node.baseLineY = CANVAS_HEIGHT/2; // Y coord at which the start -> end path will be drawn
    var baseLineX = Node.baseLineX = CANVAS_WIDTH/2 - (2*RADIUS*(maxLevel+1) + GAP*maxLevel)/2;

    var nodes_obj = new Array(num_nodes);  // Contains the Node object for each node in CFG 

    visited = new Array(num_nodes).fill(0);
    var currNode = num_nodes-1;
    var lis = []; // Contains the nodes on the start -> end path

    // Instantiating nodes on the start -> end path
    var pos;
    while (true)
    {   
        pos = [baseLineX + MARGIN +  RADIUS + 2*RADIUS*(level[currNode]) + GAP*(level[currNode]), baseLineY]
        nodes_obj[currNode] = new Node("N" + currNode, [], pos, canvas);
        visited[currNode] = 1;
        lis.push(currNode);

        if(parent[currNode] === currNode)
        {
            break;
        }
        currNode = parent[currNode];
    }

    visited = new Array(num_nodes).fill(0);
    var nodes_offset = new Array(num_nodes).fill(0);

    queue = [0];


    // Instantiating Node objects for every other node
    while(queue.length !== 0)
    {
        const node = queue.shift();
        var disp = 1;

        visited[node] = 1;

        var count = 0;


        for (let i = 0; i < adj_lis[node].length; i++) {
            const element = adj_lis[node][i];
            if (visited[element] || element === node) 
            {
                continue;
            }
            queue.push(element);

            if (lis.includes(element))
            {
                continue;
            }
            if (i === 0 && !lis.includes(node))
            {
                nodes_offset[element] = 0;    
                continue;
            }
            nodes_offset[element] = disp;
            disp = -1*disp;   
            count += 1;
            if (count % 2 === 0)
            {
                disp += 1;
            }
        }

    }

    queue = [0];
    visited = new Array(num_nodes).fill(0);
    var x, y, gap_at_level;
    while(queue.length !== 0)
    {
        const node = queue.shift();

        visited[node] = 1;

        for (let i = 0; i < adj_lis[node].length; i++) {
            const element = adj_lis[node][i];
            if (visited[element]  || element === node) 
            {
                continue;
            }

            queue.push(element);
            if (lis.includes(element))
            {
                continue;
            }
            gap_at_level = (CANVAS_HEIGHT- 2*MARGIN)/numNodesOnLevel[level[element]];

            x = baseLineX + MARGIN + RADIUS + 2*RADIUS*(level[element]) + GAP*(level[element]);
            y = nodes_obj[node].pos[1] + nodes_offset[element]*gap_at_level;

            nodes_obj[element] = new Node("N" + element, [], [x, y], canvas);
        }

    }

    return nodes_obj;
}



// Helper functions

function coordAtDist(x, y, slope, dist)
{
    var theta = Math.atan(slope);
    // if (theta < 0)
    // {
    //     theta = Math.PI + theta;
    // }
    var xo = x + Math.cos(theta)*dist;
    var yo = y + Math.sin(theta)*dist;
    return {x:xo, y:yo};
}
