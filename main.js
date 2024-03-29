"use strict";

const SNAP_DISTANCE = 3;
const MAX_IMAGE_WIDTH = 300;
const MAX_IMAGE_HEIGHT = 300;
const BINARY_THRESHOLD = 128;

function randInt(max) {
    return Math.floor(Math.random() * max);
}

/**
 * image2ImageData は HTMLImageElement を ImageData に変換します。
 * @param {HTMLImageElement} image 
 * @param {number} width 
 * @param {number} height 
 * @returns {ImageData}
 */
function image2ImageData(image, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * imageData2Image は ImageData を HTMLImageElement に変換します。
 * @param {ImageData} imageData
 * @returns {HTMLImageElement}
 */
function imageData2Image(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    const image = new Image();
    image.src = canvas.toDataURL();
    return image;
}

/**
 * shrinkImage は imageData の width と height が maxWidth と maxHeight 以下になるように 2 のべき乗に縮小します。
 * @param {ImageData} imageData
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @returns {ImageData}
 */
function shrinkImage(imageData, maxWidth, maxHeight) {
    if (imageData.width <= maxWidth && imageData.height <= maxHeight) {
        return imageData;
    }

    const srcCanvas = document.createElement('canvas');
    const srcCtx = srcCanvas.getContext('2d');
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    srcCtx.putImageData(imageData, 0, 0);

    const w = imageData.width;
    const h = imageData.height;
    const exp = Math.max(1, Math.ceil(Math.log2(Math.max(w / maxWidth, h / maxHeight))));
    const scale = Math.pow(2, exp);
    const sw = Math.floor(w / scale);
    const sh = Math.floor(h / scale);

    const dstCanvas = document.createElement('canvas');
    const dstCtx = dstCanvas.getContext('2d');
    dstCanvas.width = sw;
    dstCanvas.height = sh;
    dstCtx.drawImage(srcCanvas, 0, 0, sw, sh);

    return dstCtx.getImageData(0, 0, sw, sh);
}

function toBinaryImage(imageData, threshold) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    const dst = ctx.createImageData(imageData.width, imageData.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
        let c = 0.2126 * imageData.data[i] +
            0.7152 * imageData.data[i + 1] +
            0.0722 * imageData.data[i + 2];

        if (threshold <= c) {
            dst.data[i + 0] = 255;
            dst.data[i + 1] = 255;
            dst.data[i + 2] = 255;
        } else {
            dst.data[i + 0] = 0;
            dst.data[i + 1] = 0;
            dst.data[i + 2] = 0;
        }
        dst.data[i + 3] = 255;
    }

    return dst;
}

class MyImage {
    constructor(image, x, y) {
        this.image = image;
        this.x = x;
        this.y = y;
        this.dragging = false;
        this.lastX = x;
        this.lastY = y;
    }

    get width() {
        return this.image.width;
    }

    get height() {
        return this.image.height;
    }

    setImage = (image) => {
        this.image.src = image;
    }

    in = (x, y) => {
        return (this.x <= x && x <= this.x + this.width && this.y <= y && y <= this.y + this.height);
    }

    draw = (ctx) => {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    toImageData = () => {
        return image2ImageData(this.image, this.width, this.height);
    }
}

/**
 * shareImage は srcImage を Visual Secret Sharing Scheme を用いて分散します。
 * @param {MyImage} srcImage
 * @returns {MyImage[]}
 */
function shareImage(srcImage) {
    const patterns = [
        [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 255, 0, 0, 0, 255,
        ],
        [
            0, 0, 0, 255, 0, 0, 0, 255,
            0, 0, 0, 0, 0, 0, 0, 0,
        ],
        [
            0, 0, 0, 0, 0, 0, 0, 255,
            0, 0, 0, 0, 0, 0, 0, 255,
        ],
        [
            0, 0, 0, 255, 0, 0, 0, 0,
            0, 0, 0, 255, 0, 0, 0, 0,
        ],
        [
            0, 0, 0, 0, 0, 0, 0, 255,
            0, 0, 0, 255, 0, 0, 0, 0,
        ],
        [
            0, 0, 0, 255, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 255,
        ],
    ]
    const blackPairs = [
        [0, 1],
        [1, 0],
        [2, 3],
        [3, 2],
        [4, 5],
        [5, 4],
    ]

    const srcImageData = srcImage.toImageData();

    const canvas = document.createElement('canvas');
    canvas.width = srcImageData.width;
    canvas.height = srcImageData.height;
    const ctx = canvas.getContext('2d');

    const sw = srcImageData.width;
    const w = srcImageData.width * 2;
    const h = srcImageData.height * 2;

    const sharedImageData1 = ctx.createImageData(w, h);
    const sharedImageData2 = ctx.createImageData(w, h);

    for (let i = 0; i < srcImageData.data.length; i += 4) {

        const ystride = Math.trunc(i / (sw * 4)) * (w * 4);
        const j = (2 * i) + ystride;

        const isBlack = srcImageData.data[i + 0] == 0 &&
            srcImageData.data[i + 1] == 0 &&
            srcImageData.data[i + 2] == 0 &&
            srcImageData.data[i + 3] == 255

        if (isBlack) {
            const pair = blackPairs[randInt(blackPairs.length)]
            const p1 = patterns[pair[0]]
            const p2 = patterns[pair[1]]

            for (let k = 0; k < 8; k++) {
                sharedImageData1.data[j + k] = p1[k]
                sharedImageData1.data[j + (w * 4) + k] = p1[k + 8]
                sharedImageData2.data[j + k] = p2[k]
                sharedImageData2.data[j + (w * 4) + k] = p2[k + 8]
            }
        } else {
            const p = patterns[randInt(patterns.length)]

            for (let k = 0; k < 8; k++) {
                sharedImageData1.data[j + k] = p[k]
                sharedImageData1.data[j + (w * 4) + k] = p[k + 8]
                sharedImageData2.data[j + k] = p[k]
                sharedImageData2.data[j + (w * 4) + k] = p[k + 8]
            }
        }
    }

    const offsetX = w / 2;
    const offsetY = h / 2;
    const sharedImage1 = new MyImage(imageData2Image(sharedImageData1), offsetX * 0, offsetY * 0);
    const sharedImage2 = new MyImage(imageData2Image(sharedImageData2), offsetX * 1, offsetY * 1);

    return [sharedImage1, sharedImage2];
}

class App {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.images = [];
        this.originalImage = new Image();

        this.canvas.addEventListener('mousedown', this.handleMouseDown, false);
        this.canvas.addEventListener('mouseup', this.handleMouseUp, false);
        this.canvas.addEventListener('mousemove', this.handleMouseMove, false);
        this.canvas.addEventListener('touchstart', this.handleMouseDown, false);
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMouseMove(e);
        }, false);
        this.canvas.addEventListener('touchend', this.handleMouseUp, false);
    }

    draw = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.images.forEach(img => img.draw(this.ctx));
    }

    clear = () => {
        this.originalImage = new Image();
        this.images = [];
        document.getElementById('originalImageBox').innerHTML = '';
        document.getElementById('binaryImageBox').innerHTML = '';
        document.getElementById('sharedImageBox').innerHTML = '';
        this.draw();
    }

    handleMouseDown = (e) => {
        if (e.type == 'touchstart') {
            var mouseX = e.touches[0].clientX - this.canvas.offsetLeft;
            var mouseY = e.touches[0].clientY - this.canvas.offsetTop;
        } else {
            var mouseX = e.clientX - this.canvas.offsetLeft;
            var mouseY = e.clientY - this.canvas.offsetTop;
        }

        for (let img of this.images.slice().reverse()) {
            if (img.in(mouseX, mouseY)) {
                img.dragging = true;
                img.lastX = mouseX;
                img.lastY = mouseY;
                break;
            }
        }
    }

    handleMouseUp = () => {
        this.images.forEach(img => img.dragging = false);
    }

    handleMouseMove = (e) => {
        if (e.type == 'touchmove') {
            var mouseX = e.touches[0].clientX - this.canvas.offsetLeft;
            var mouseY = e.touches[0].clientY - this.canvas.offsetTop;
        } else {
            var mouseX = e.clientX - this.canvas.offsetLeft;
            var mouseY = e.clientY - this.canvas.offsetTop;
        }

        for (let img of this.images) {
            if (img.dragging) {
                const dx = mouseX - img.lastX;
                const dy = mouseY - img.lastY;
                img.x += dx;
                img.y += dy;
                img.lastX = mouseX;
                img.lastY = mouseY;

                // 近くの画像にスナップさせる
                for (let img2 of this.images) {
                    if (img2 == img) continue;
                    if (Math.abs(img.x - img2.x) < SNAP_DISTANCE) {
                        img.x = img2.x;
                    }
                    if (Math.abs(img.y - img2.y) < SNAP_DISTANCE) {
                        img.y = img2.y;
                    }
                }
            }
        }

        this.draw();
    }

    setImage(image) {
        this.clear();


        const sleep = waitTime => new Promise(resolve => setTimeout(resolve, waitTime));

        sleep(500).then(() => {
            let img = image2ImageData(image, image.width, image.height);

            sleep(500).then(() => {
                img = shrinkImage(img, MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT);
                const shrinkedImage = new MyImage(
                    imageData2Image(img), 0, 0);
                document.getElementById('originalImageBox').appendChild(shrinkedImage.image);

                img = toBinaryImage(img, BINARY_THRESHOLD);
                const binaryImage = new MyImage(
                    imageData2Image(img), 0, 0);
                document.getElementById('binaryImageBox').appendChild(binaryImage.image);

                this.canvas.width = img.width * 3;
                this.canvas.height = img.height * 3;

                sleep(500).then(() => {

                    const sharedImages = shareImage(binaryImage);
                    for (let img of sharedImages) {
                        this.images.push(img);
                        document.getElementById('sharedImageBox').appendChild(img.image);
                    }
                });
            });
        });

        this.draw();
    }

    handleImage = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            this.originalImage.onload = () => this.setImage(this.originalImage);
            this.originalImage.src = event.target.result;
        }
        reader.readAsDataURL(e.target.files[0]);
    }

    handleImageSelector = (e) => {
        this.originalImage.onload = () => this.setImage(this.originalImage);
        if (e.target.value === "Lenna") {
            this.originalImage.src = "images/Lenna.jpg";
        } else if (e.target.value === "qrcode") {
            this.originalImage.src = "images/qrcode.png";
        }
    }
}

const canvas = document.getElementById('canvas');
const app = new App(canvas);

document.getElementById('imageLoader').addEventListener('change', app.handleImage, false);
document.getElementById('imageSelector').addEventListener('change', app.handleImageSelector, false);

