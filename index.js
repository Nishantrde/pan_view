var createSphere = require('primitive-sphere');
var createControls = require('orbit-control');
var createCamera = require('perspective-camera');
var createRegl = require('raf-loop');
var defined = require('defined');
var assign = require('object-assign');

var sphere;

module.exports = create360Viewer;
function create360Viewer (opt){
    opt = opt || {};
    var canvas = opt.canvas || document.createElement('canvas');

    if (!sphere){
        sphere = createSphere(1,{
            segement: 64
        });
    }

    var regl = createRegl({
        canvas: canvas
    });

    var camera = createCamera({
        fov: defined(opt.fov, 45 * Math.PI / 180),
        near: 0.1,
        far: 10,
    })

    var controls = createControls(assign({}, opt, {
        element: canvas,
        parent: window,
        rotateSpeed: defined(opt.rotateSpeed, 0.75 / (Math.PI * 2)),
        damping: defined(opt.damping, 0.35),
        zoom: false,
        pinch: false,
        distance: 0 
    }));

    var clearOpts = {
            color: [0,0,0,0],
            depth: 1
    }

}


