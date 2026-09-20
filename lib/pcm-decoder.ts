/** OpenAI PCM is mono, 24 kHz, signed 16-bit little-endian; chunks may split samples. */
export class PcmDecoder {
  private leftover: number | undefined;

  push(bytes: Uint8Array): Float32Array<ArrayBuffer> {
    const data = new Uint8Array(bytes.length + (this.leftover === undefined ? 0 : 1));
    if (this.leftover !== undefined) data[0] = this.leftover;
    data.set(bytes, this.leftover === undefined ? 0 : 1);
    const samples = new Float32Array(Math.floor(data.length / 2));
    const view = new DataView(data.buffer);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    this.leftover = data.length % 2 ? data[data.length - 1] : undefined;
    return samples;
  }

  finish() {
    if (this.leftover !== undefined) throw new Error("The audio stream ended with an incomplete sample.");
  }
}
