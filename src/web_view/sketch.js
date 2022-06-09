console.log("HHAHAH")

function setup() {
    createCanvas(windowWidth, windowHeight);
}

function draw() {
    background(0);
    ellipse(50,50,80,80);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
  }