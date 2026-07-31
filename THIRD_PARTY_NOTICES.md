# Third-party notices

Persona Chat Bridge is a modified fork of [Persona by xikhar](https://github.com/xikhar/persona), licensed under the MIT License. The original copyright and license notice are preserved in `LICENSE`.

The local multilingual expression classifier uses:

- [Transformers.js](https://github.com/huggingface/transformers.js), licensed under Apache-2.0.
- [tanaos-emotion-detection-v1-ONNX](https://huggingface.co/onnx-community/tanaos-emotion-detection-v1-ONNX), derived from `tanaos/tanaos-emotion-detection-v1` and licensed under MIT.

The classifier model is downloaded on first use and cached locally. Conversation text is processed on the user's device and is not uploaded to Hugging Face.

No VRM character model or VRMA animation file is distributed with this repository or its releases. Users must provide their own assets and comply with each asset's license.
