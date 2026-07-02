"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const width = 64;
const height = 64;
const pixels = Buffer.alloc(width * height * 4);

const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
	let value = index;

	for (let bit = 0; bit < 8; bit += 1) {
		value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
	}

	crcTable[index] = value >>> 0;
}

const crc32 = (buffer) => {
	let crc = 0xFFFFFFFF;

	for (const byte of buffer) {
		crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
	}

	return (crc ^ 0xFFFFFFFF) >>> 0;
};

const chunk = (type, data) => {
	const typeBuffer = Buffer.from(type, "ascii");
	const length = Buffer.alloc(4);
	const crc = Buffer.alloc(4);

	length.writeUInt32BE(data.length, 0);
	crc.writeUInt32BE(crc32(Buffer.concat([
		typeBuffer,
		data
	])), 0);

	return Buffer.concat([
		length,
		typeBuffer,
		data,
		crc
	]);
};

const setPixel = (x, y, color) => {
	if (x < 0 || x >= width || y < 0 || y >= height) {
		return;
	}

	const offset = (y * width + x) * 4;

	pixels[offset] = color[0];
	pixels[offset + 1] = color[1];
	pixels[offset + 2] = color[2];
	pixels[offset + 3] = color[3];
};

const drawCircle = (centerX, centerY, radius, color) => {
	for (let y = centerY - radius; y <= centerY + radius; y += 1) {
		for (let x = centerX - radius; x <= centerX + radius; x += 1) {
			const distanceX = x - centerX;
			const distanceY = y - centerY;

			if (distanceX * distanceX + distanceY * distanceY <= radius * radius) {
				setPixel(x, y, color);
			}
		}
	}
};

const drawRoundedRect = (left, top, rectWidth, rectHeight, radius, color) => {
	for (let y = top; y < top + rectHeight; y += 1) {
		for (let x = left; x < left + rectWidth; x += 1) {
			const nearestX = Math.max(left + radius, Math.min(x, left + rectWidth - radius - 1));
			const nearestY = Math.max(top + radius, Math.min(y, top + rectHeight - radius - 1));
			const distanceX = x - nearestX;
			const distanceY = y - nearestY;

			if (distanceX * distanceX + distanceY * distanceY <= radius * radius) {
				setPixel(x, y, color);
			}
		}
	}
};

const drawRect = (left, top, rectWidth, rectHeight, color) => {
	for (let y = top; y < top + rectHeight; y += 1) {
		for (let x = left; x < left + rectWidth; x += 1) {
			setPixel(x, y, color);
		}
	}
};

drawRoundedRect(9, 13, 43, 40, 7, [
	0,
	95,
	104,
	255
]);
drawRoundedRect(19, 8, 36, 42, 7, [
	0,
	158,
	150,
	255
]);
drawCircle(18, 33, 12, [
	3,
	119,
	132,
	255
]);

const white = [
	255,
	255,
	255,
	255
];

drawRect(27, 18, 20, 6, white);
drawRect(27, 18, 6, 18, white);
drawRect(27, 31, 20, 6, white);
drawRect(41, 31, 6, 18, white);
drawRect(27, 44, 20, 6, white);

const scanlines = Buffer.alloc((width * 4 + 1) * height);

for (let y = 0; y < height; y += 1) {
	const scanlineOffset = y * (width * 4 + 1);

	scanlines[scanlineOffset] = 0;
	pixels.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
}

const header = Buffer.alloc(13);

header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
header[10] = 0;
header[11] = 0;
header[12] = 0;

const png = Buffer.concat([
	Buffer.from([
		0x89,
		0x50,
		0x4E,
		0x47,
		0x0D,
		0x0A,
		0x1A,
		0x0A
	]),
	chunk("IHDR", header),
	chunk("IDAT", zlib.deflateSync(scanlines)),
	chunk("IEND", Buffer.alloc(0))
]);

fs.writeFileSync(path.join(__dirname, "..", "icon.png"), png);
