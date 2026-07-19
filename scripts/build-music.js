"use strict";

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 11025;
const STEP_SECONDS = .19;
const MELODY = [
  1046.5,659.25,783.99,880,783.99,659.25,587.33,659.25,
  783.99,0,880,783.99,659.25,587.33,523.25,0,
  659.25,783.99,987.77,880,783.99,659.25,587.33,783.99,
  1046.5,987.77,880,783.99,659.25,587.33,523.25,0
];
const BASS = [261.63,261.63,349.23,392,261.63,349.23,392,392];
const sampleCount = Math.round(MELODY.length * STEP_SECONDS * SAMPLE_RATE);

function envelope(time, duration) {
  const attack = Math.min(1, time / .008);
  const release = Math.min(1, Math.max(0, duration - time) / .025);
  return Math.max(0, Math.min(attack, release));
}

function square(frequency, time) {
  return Math.sin(Math.PI * 2 * frequency * time) >= 0 ? 1 : -1;
}

function triangle(frequency, time) {
  return 2 * Math.abs(2 * ((frequency * time) % 1) - 1) - 1;
}

const pcm = Buffer.alloc(sampleCount);
for (let index = 0; index < sampleCount; index++) {
  const absoluteTime = index / SAMPLE_RATE;
  const step = Math.floor(absoluteTime / STEP_SECONDS);
  const stepTime = absoluteTime - step * STEP_SECONDS;
  let sample = 0;
  const melody = MELODY[step];
  if (melody && stepTime < .14) sample += square(melody, stepTime) * envelope(stepTime, .14) * .26;
  if (step % 4 === 0 && stepTime < .22) {
    const bass = BASS[Math.floor(step / 4) % BASS.length];
    sample += triangle(bass, stepTime) * envelope(stepTime, .22) * .18;
  }
  const limited = Math.max(-1, Math.min(1, sample));
  pcm[index] = Math.round(128 + limited * 112);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE, 28);
header.writeUInt16LE(1, 32);
header.writeUInt16LE(8, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const outputDirectory = path.resolve(__dirname, "..", "assets");
const outputPath = path.join(outputDirectory, "cool-call-theme.wav");
fs.mkdirSync(outputDirectory, { recursive:true });
fs.writeFileSync(outputPath, Buffer.concat([header, pcm]));
console.log(`Built ${outputPath} (${pcm.length + header.length} bytes)`);
