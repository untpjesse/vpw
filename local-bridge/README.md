# VCX Nano Local Hardware Bridge

This folder contains a Python script that acts as a local WebSocket bridge between your physical VCX Nano hardware (or any J2534 device) and the cloud-hosted web application.

## Why is this needed?
The web application runs in a cloud container (Linux) and cannot directly access USB devices or load Windows DLLs (like `vxdiag.dll` or `j2534.dll`) on your local machine. This bridge runs locally on your Windows PC, loads the J2534 driver using Python `ctypes`, and communicates with the web app over a secure WebSocket.

The bridge script now uses `ctypes` to map the full J2534 C API to Python, allowing it to communicate directly with the physical VCX Nano hardware.

## Supported J2534 Functions

The bridge currently implements the following core J2534 functions:
*   `PassThruOpen`
*   `PassThruConnect`
*   `PassThruDisconnect`
*   `PassThruClose`
*   `PassThruStartMsgFilter` (Pass-all filter)
*   `PassThruStopMsgFilter`
*   `PassThruWriteMsgs`
*   `PassThruReadMsgs`

## Prerequisites
1. **Windows PC** with your VCX Nano plugged in via USB or connected via WiFi.
2. **VX Manager** installed and the J2534 driver enabled.
3. **Python 3.8+** installed on your Windows PC.

## Installation
1. Download this `local-bridge` folder to your Windows PC.
2. Open a command prompt or PowerShell in this folder.
3. Install the required Python package:
   ```bash
   pip install websockets
   ```

## Usage
1. Run the bridge script:
   ```bash
   python vcx_bridge.py
   ```
2. The script will start a WebSocket server on `ws://127.0.0.1:8080`.
3. In the web application, go to the **Dashboard**, toggle the connection mode to **Local Hardware Bridge**, and click **Connect**.

## Troubleshooting
- If the script fails to load the DLL, open `vcx_bridge.py` and verify that `DLL_PATH` matches the installation path of your VXDIAG driver (usually `C:\Program Files (x86)\VCX\VXDIAG\J2534\vxdiag.dll` or `C:\ProgramData\VXDIAG\USER\J2534\vxdiag.dll`).
- Ensure no other diagnostic software (like Tech2Win or GDS2) is currently using the VCX Nano.
