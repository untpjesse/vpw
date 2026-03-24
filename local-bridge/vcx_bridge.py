import asyncio
import websockets
import json
import ctypes
from ctypes import c_uint32, c_void_p, c_char_p, POINTER, Structure, c_uint8, byref, create_string_buffer
import sys
import os

# ==============================================================================
# VCX Nano / J2534 Local WebSocket Bridge
# ==============================================================================
# This script loads the Windows J2534 DLL (vxdiag.dll) and exposes a WebSocket
# server on port 8080. The cloud web application connects to this WebSocket
# to send and receive raw J2534 commands to the physical hardware.
# ==============================================================================

# Common paths for the VCX Nano J2534 DLL
DLL_PATHS = [
    r"C:\Program Files (x86)\VCX\VXDIAG\J2534\vxdiag.dll",
    r"C:\ProgramData\VXDIAG\USER\J2534\vxdiag.dll",
    r"C:\Windows\System32\vxdiag.dll"
]

j2534_dll = None

# Attempt to load the DLL
for path in DLL_PATHS:
    if os.path.exists(path):
        try:
            j2534_dll = ctypes.WinDLL(path)
            print(f"[+] Successfully loaded VCX Nano DLL: {path}")
            break
        except Exception as e:
            print(f"[-] Found DLL at {path} but failed to load: {e}")

if not j2534_dll:
    print("[-] Could not find or load the VCX Nano J2534 DLL.")
    print("    Please ensure VX Manager is installed and the J2534 driver is enabled.")
    print("    If installed in a custom location, update the DLL_PATHS list in this script.")
    # We won't exit here so the bridge can still run in "simulation" mode if DLL is missing
    # sys.exit(1)

# J2534 Constants
STATUS_NOERROR = 0
ERR_NOT_SUPPORTED = 1
ERR_INVALID_CHANNEL_ID = 2
ERR_INVALID_PROTOCOL_ID = 3
ERR_NULL_PARAMETER = 4
ERR_INVALID_IOCTL_VALUE = 5
ERR_INVALID_FLAGS = 6
ERR_FAILED = 7
ERR_DEVICE_NOT_CONNECTED = 8
ERR_TIMEOUT = 9

# Protocols
PROTOCOL_MAP = {
    "J1850VPW": 1,
    "J1850PWM": 2,
    "ISO9141": 3,
    "ISO14230": 4,
    "CAN": 5,
    "ISO15765": 6,
    "SCI_A_ENGINE": 7,
    "SCI_A_TRANS": 8,
    "SCI_B_ENGINE": 9,
    "SCI_B_TRANS": 10
}

# Filter Types
PASS_FILTER = 1
BLOCK_FILTER = 2
FLOW_CONTROL_FILTER = 3

class PASSTHRU_MSG(Structure):
    _fields_ = [
        ("ProtocolID", c_uint32),
        ("RxStatus", c_uint32),
        ("TxFlags", c_uint32),
        ("Timestamp", c_uint32),
        ("DataSize", c_uint32),
        ("ExtraDataIndex", c_uint32),
        ("Data", c_uint8 * 4128)
    ]

# Define C function prototypes if DLL is loaded
if j2534_dll:
    try:
        j2534_dll.PassThruOpen.argtypes = [c_void_p, POINTER(c_uint32)]
        j2534_dll.PassThruOpen.restype = c_uint32

        j2534_dll.PassThruClose.argtypes = [c_uint32]
        j2534_dll.PassThruClose.restype = c_uint32

        j2534_dll.PassThruConnect.argtypes = [c_uint32, c_uint32, c_uint32, c_uint32, POINTER(c_uint32)]
        j2534_dll.PassThruConnect.restype = c_uint32

        j2534_dll.PassThruDisconnect.argtypes = [c_uint32]
        j2534_dll.PassThruDisconnect.restype = c_uint32

        j2534_dll.PassThruReadMsgs.argtypes = [c_uint32, POINTER(PASSTHRU_MSG), POINTER(c_uint32), c_uint32]
        j2534_dll.PassThruReadMsgs.restype = c_uint32

        j2534_dll.PassThruWriteMsgs.argtypes = [c_uint32, POINTER(PASSTHRU_MSG), POINTER(c_uint32), c_uint32]
        j2534_dll.PassThruWriteMsgs.restype = c_uint32

        j2534_dll.PassThruStartMsgFilter.argtypes = [c_uint32, c_uint32, POINTER(PASSTHRU_MSG), POINTER(PASSTHRU_MSG), POINTER(PASSTHRU_MSG), POINTER(c_uint32)]
        j2534_dll.PassThruStartMsgFilter.restype = c_uint32

        j2534_dll.PassThruStopMsgFilter.argtypes = [c_uint32, c_uint32]
        j2534_dll.PassThruStopMsgFilter.restype = c_uint32
    except AttributeError as e:
        print(f"[-] Error mapping J2534 functions: {e}")
        j2534_dll = None

# Global state
device_id = c_uint32(0)
channel_id = c_uint32(0)
filter_id = c_uint32(0)
active_protocol_id = 0

def hex_to_bytes(hex_str):
    hex_str = hex_str.replace(" ", "")
    return bytes.fromhex(hex_str)

def bytes_to_hex(byte_array, length):
    return " ".join(f"{b:02X}" for b in byte_array[:length])

async def handle_client(websocket):
    global device_id, channel_id, filter_id, active_protocol_id
    print(f"[+] Web Application connected from {websocket.remote_address}")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                
                if action == "ping":
                    await websocket.send(json.dumps({"success": True, "action": "pong"}))
                
                elif action == "connect":
                    protocol_str = data.get("protocol", "ISO15765")
                    baud_rate = int(data.get("baudRate", 500000))
                    active_protocol_id = PROTOCOL_MAP.get(protocol_str, 6) # Default ISO15765
                    
                    if not j2534_dll:
                        print(f"[*] [SIMULATED] Connect to protocol {protocol_str} at {baud_rate} bps")
                        await websocket.send(json.dumps({
                            "success": True, 
                            "action": "connect", 
                            "message": f"[SIMULATED] Connected to {protocol_str} (DLL not loaded)"
                        }))
                        continue

                    # 1. PassThruOpen
                    status = j2534_dll.PassThruOpen(None, byref(device_id))
                    if status != STATUS_NOERROR:
                        await websocket.send(json.dumps({"success": False, "error": f"PassThruOpen failed: {status}"}))
                        continue
                    
                    # 2. PassThruConnect
                    flags = 0
                    status = j2534_dll.PassThruConnect(device_id, active_protocol_id, flags, baud_rate, byref(channel_id))
                    if status != STATUS_NOERROR:
                        j2534_dll.PassThruClose(device_id)
                        await websocket.send(json.dumps({"success": False, "error": f"PassThruConnect failed: {status}"}))
                        continue

                    # 3. PassThruStartMsgFilter (Pass all)
                    mask_msg = PASSTHRU_MSG()
                    mask_msg.ProtocolID = active_protocol_id
                    mask_msg.DataSize = 4
                    mask_msg.Data[0:4] = (0x00, 0x00, 0x00, 0x00)

                    pattern_msg = PASSTHRU_MSG()
                    pattern_msg.ProtocolID = active_protocol_id
                    pattern_msg.DataSize = 4
                    pattern_msg.Data[0:4] = (0x00, 0x00, 0x00, 0x00)

                    status = j2534_dll.PassThruStartMsgFilter(
                        channel_id, PASS_FILTER, byref(mask_msg), byref(pattern_msg), None, byref(filter_id)
                    )
                    
                    print(f"[+] Connected to physical VCX Nano hardware. DeviceID: {device_id.value}, ChannelID: {channel_id.value}")
                    await websocket.send(json.dumps({
                        "success": True, 
                        "action": "connect", 
                        "message": f"Connected to physical hardware ({protocol_str})"
                    }))
                
                elif action == "send":
                    msg_hex = data.get("message", "")
                    print(f"[*] Command received: Send message -> {msg_hex}")
                    
                    if not j2534_dll or channel_id.value == 0:
                        # Simulated response
                        sim_resp = "41 00 00 00"
                        if msg_hex.startswith("01"):
                            sim_resp = "41 " + msg_hex[3:] + " 00 00"
                        await websocket.send(json.dumps({
                            "success": True,
                            "action": "send",
                            "sent": msg_hex,
                            "received": sim_resp
                        }))
                        continue

                    # Real Hardware Send
                    try:
                        tx_bytes = hex_to_bytes(msg_hex)
                        tx_msg = PASSTHRU_MSG()
                        tx_msg.ProtocolID = active_protocol_id
                        tx_msg.DataSize = len(tx_bytes)
                        for i, b in enumerate(tx_bytes):
                            tx_msg.Data[i] = b
                        
                        num_msgs = c_uint32(1)
                        timeout = 1000 # 1 second timeout
                        
                        status = j2534_dll.PassThruWriteMsgs(channel_id, byref(tx_msg), byref(num_msgs), timeout)
                        if status != STATUS_NOERROR:
                            await websocket.send(json.dumps({"success": False, "error": f"PassThruWriteMsgs failed: {status}"}))
                            continue
                        
                        # Read Response
                        rx_msg = PASSTHRU_MSG()
                        num_msgs = c_uint32(1)
                        status = j2534_dll.PassThruReadMsgs(channel_id, byref(rx_msg), byref(num_msgs), timeout)
                        
                        if status == STATUS_NOERROR and num_msgs.value > 0:
                            rx_hex = bytes_to_hex(rx_msg.Data, rx_msg.DataSize)
                            await websocket.send(json.dumps({
                                "success": True,
                                "action": "send",
                                "sent": msg_hex,
                                "received": rx_hex
                            }))
                        else:
                            await websocket.send(json.dumps({
                                "success": True,
                                "action": "send",
                                "sent": msg_hex,
                                "received": "NO DATA"
                            }))
                            
                    except Exception as e:
                        print(f"[-] Error sending/receiving: {e}")
                        await websocket.send(json.dumps({"success": False, "error": str(e)}))
                    
                elif action == "disconnect":
                    print("[*] Command received: Disconnect")
                    if j2534_dll and channel_id.value != 0:
                        if filter_id.value != 0:
                            j2534_dll.PassThruStopMsgFilter(channel_id, filter_id)
                        j2534_dll.PassThruDisconnect(channel_id)
                        j2534_dll.PassThruClose(device_id)
                        channel_id.value = 0
                        device_id.value = 0
                        filter_id.value = 0
                        
                    await websocket.send(json.dumps({"success": True, "action": "disconnect"}))
                    
                else:
                    print(f"[-] Unknown action: {action}")
                    await websocket.send(json.dumps({"success": False, "error": "Unknown action"}))
                    
            except json.JSONDecodeError:
                print("[-] Received invalid JSON")
    except websockets.exceptions.ConnectionClosed:
        print(f"[-] Web Application disconnected.")
        if j2534_dll and channel_id.value != 0:
            j2534_dll.PassThruDisconnect(channel_id)
            j2534_dll.PassThruClose(device_id)
            channel_id.value = 0
            device_id.value = 0

async def main():
    print("==================================================")
    print(" VCX Nano J2534 Local Hardware Bridge")
    print("==================================================")
    print("Starting WebSocket server on ws://127.0.0.1:8080...")
    print("Waiting for connection from the web application...")
    
    async with websockets.serve(handle_client, "127.0.0.1", 8080):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge stopped by user.")

