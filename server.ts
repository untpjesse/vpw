import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- J2534 Mock Backend ---
  let devices = [
    { id: "tactrix", name: "Tactrix OpenPort 2.0", connectionType: "USB", isConnected: false, protocol: null, savedProtocol: "ISO15765", baudRate: "500000", pins: "6/14" },
    { id: "mongoose", name: "Mongoose Pro", connectionType: "USB", isConnected: false, protocol: null, savedProtocol: "ISO15765", baudRate: "500000", pins: "6/14" }
  ];

  const checkAnyConnected = () => devices.some(d => d.isConnected);

  app.get("/api/devices", (req, res) => {
    res.json({ devices });
  });

  app.get("/api/bridge-script", (req, res) => {
    const script = `import asyncio
import websockets
import json
import time

# This is a local bridge script to connect the web application
# to your physical J2534 hardware (like Tactrix, Mongoose, VCX Nano).
# 
# Prerequisites:
# 1. Install Python 3.7+
# 2. Install websockets: pip install websockets
# 3. Run this script: python j2534_bridge.py

async def j2534_handler(websocket):
    print("✅ Web app connected to local bridge!")
    try:
        async for message in websocket:
            data = json.loads(message)
            print(f"📥 Received from web app: {data}")
            
            action = data.get("action")
            
            if action == "connect":
                protocol = data.get("protocol", "ISO15765")
                baud = data.get("baudRate", "500000")
                print(f"🔌 Connecting to J2534 hardware (Protocol: {protocol}, Baud: {baud})...")
                
                # TODO: Initialize your J2534 DLL here (e.g., using ctypes)
                # PassThruOpen(), PassThruConnect()
                
                await asyncio.sleep(0.5) # Simulate connection delay
                await websocket.send(json.dumps({"success": True, "message": "Connected to physical hardware"}))
                
            elif action == "send":
                msg = data.get("message", "")
                print(f"🚗 Sending to vehicle: {msg}")
                
                # TODO: Send message via J2534 DLL
                # PassThruWriteMsgs(), PassThruReadMsgs()
                
                # Mock response for testing the bridge
                await asyncio.sleep(0.1)
                await websocket.send(json.dumps({"success": True, "received": "41 00 BF 9F E9 91"}))
                
            elif action == "disconnect":
                print("🔌 Disconnecting from hardware...")
                # TODO: PassThruDisconnect(), PassThruClose()
                await websocket.send(json.dumps({"success": True, "message": "Disconnected"}))
                
    except websockets.exceptions.ConnectionClosed:
        print("❌ Web app disconnected.")

async def main():
    print("🚀 J2534 Local Bridge Server starting...")
    print("📡 Listening on ws://127.0.0.1:8080")
    print("⏳ Waiting for web app to connect...")
    async with websockets.serve(j2534_handler, "127.0.0.1", 8080):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
`;
    res.setHeader('Content-Disposition', 'attachment; filename="j2534_bridge.py"');
    res.setHeader('Content-Type', 'text/plain');
    res.send(script);
  });

  app.get("/api/bridge-script/cpp", (req, res) => {
    const script = `// j2534_bridge.cpp
// C++ Local Hardware Bridge for J2534
// Requires: websocketpp, asio, nlohmann-json
// Build Instructions (Windows / MSVC):
//   1. Install vcpkg: https://vcpkg.io/en/
//   2. vcpkg install websocketpp nlohmann-json
//   3. cl /EHsc j2534_bridge.cpp /I vcpkg_installed\\x64-windows\\include

#include <iostream>
#include <string>
#include <vector>
#include <windows.h>

#define ASIO_STANDALONE
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
typedef websocketpp::server<websocketpp::config::asio> server;

// J2534 Constants & Definitions
#define STATUS_NOERROR 0
#define PASS_FILTER 1

typedef struct {
    unsigned long ProtocolID;
    unsigned long RxStatus;
    unsigned long TxFlags;
    unsigned long Timestamp;
    unsigned long DataSize;
    unsigned long ExtraDataIndex;
    unsigned char Data[4128];
} PASSTHRU_MSG;

typedef long (WINAPI *PTOPEN)(void*, unsigned long*);
typedef long (WINAPI *PTCLOSE)(unsigned long);
typedef long (WINAPI *PTCONNECT)(unsigned long, unsigned long, unsigned long, unsigned long, unsigned long*);
typedef long (WINAPI *PTDISCONNECT)(unsigned long);
typedef long (WINAPI *PTREADMSGS)(unsigned long, PASSTHRU_MSG*, unsigned long*, unsigned long);
typedef long (WINAPI *PTWRITEMSGS)(unsigned long, PASSTHRU_MSG*, unsigned long*, unsigned long);
typedef long (WINAPI *PTSTARTMSGFILTER)(unsigned long, unsigned long, PASSTHRU_MSG*, PASSTHRU_MSG*, PASSTHRU_MSG*, unsigned long*);
typedef long (WINAPI *PTSTOPMSGFILTER)(unsigned long, unsigned long);

PTOPEN PassThruOpen = nullptr;
PTCLOSE PassThruClose = nullptr;
PTCONNECT PassThruConnect = nullptr;
PTDISCONNECT PassThruDisconnect = nullptr;
PTREADMSGS PassThruReadMsgs = nullptr;
PTWRITEMSGS PassThruWriteMsgs = nullptr;
PTSTARTMSGFILTER PassThruStartMsgFilter = nullptr;
PTSTOPMSGFILTER PassThruStopMsgFilter = nullptr;

unsigned long deviceId = 0;
unsigned long channelId = 0;
unsigned long filterId = 0;

bool LoadJ2534DLL(const std::string& path) {
    HMODULE hMod = LoadLibraryA(path.c_str());
    if (!hMod) return false;
    PassThruOpen = (PTOPEN)GetProcAddress(hMod, "PassThruOpen");
    PassThruClose = (PTCLOSE)GetProcAddress(hMod, "PassThruClose");
    PassThruConnect = (PTCONNECT)GetProcAddress(hMod, "PassThruConnect");
    PassThruDisconnect = (PTDISCONNECT)GetProcAddress(hMod, "PassThruDisconnect");
    PassThruReadMsgs = (PTREADMSGS)GetProcAddress(hMod, "PassThruReadMsgs");
    PassThruWriteMsgs = (PTWRITEMSGS)GetProcAddress(hMod, "PassThruWriteMsgs");
    PassThruStartMsgFilter = (PTSTARTMSGFILTER)GetProcAddress(hMod, "PassThruStartMsgFilter");
    PassThruStopMsgFilter = (PTSTOPMSGFILTER)GetProcAddress(hMod, "PassThruStopMsgFilter");
    return PassThruOpen != nullptr;
}

std::vector<unsigned char> HexToBytes(const std::string& hex) {
    std::vector<unsigned char> bytes;
    for (size_t i = 0; i < hex.length(); i += 2) {
        if(hex[i] == ' ') { i--; continue; }
        std::string byteString = hex.substr(i, 2);
        unsigned char byte = (unsigned char)strtol(byteString.c_str(), nullptr, 16);
        bytes.push_back(byte);
    }
    return bytes;
}

std::string BytesToHex(const unsigned char* data, unsigned long length) {
    std::string hex;
    char buf[4];
    for (unsigned long i = 0; i < length; ++i) {
        snprintf(buf, sizeof(buf), "%02X ", data[i]);
        hex += buf;
    }
    if (!hex.empty()) hex.pop_back();
    return hex;
}

void on_message(server* s, websocketpp::connection_hdl hdl, server::message_ptr msg) {
    auto payload = msg->get_payload();
    try {
        json data = json::parse(payload);
        std::string action = data.value("action", "");
        
        if (action == "connect") {
            unsigned long protocol = 6; // ISO15765
            if (data.value("protocol", "ISO15765") == "J1850PWM") protocol = 2; // PWM
            unsigned long baud = std::stoul(data.value("baudRate", "500000"));

            if (PassThruOpen) {
                PassThruOpen(nullptr, &deviceId);
                PassThruConnect(deviceId, protocol, 0, baud, &channelId);
                
                PASSTHRU_MSG mask = {0}; mask.ProtocolID = protocol; mask.DataSize = 4;
                PASSTHRU_MSG pat = {0}; pat.ProtocolID = protocol; pat.DataSize = 4;
                PassThruStartMsgFilter(channelId, PASS_FILTER, &mask, &pat, nullptr, &filterId);
            }
            json resp = {{"success", true}, {"action", "connect"}, {"message", "Connected via C++ Bridge"}};
            s->send(hdl, resp.dump(), websocketpp::frame::opcode::text);
        }
        else if (action == "disconnect") {
            if (PassThruDisconnect && channelId != 0) {
                PassThruStopMsgFilter(channelId, filterId);
                PassThruDisconnect(channelId);
                PassThruClose(deviceId);
                channelId = 0; deviceId = 0; filterId = 0;
            }
            json resp = {{"success", true}, {"action", "disconnect"}};
            s->send(hdl, resp.dump(), websocketpp::frame::opcode::text);
        }
        else if (action == "send") {
            std::string msgHex = data.value("message", "");
            std::vector<unsigned char> txBytes = HexToBytes(msgHex);
            
            std::string rxHex = "NO DATA";
            if (PassThruWriteMsgs && channelId != 0) {
                PASSTHRU_MSG txMsg = {0};
                txMsg.ProtocolID = 6;
                txMsg.DataSize = txBytes.size();
                memcpy(txMsg.Data, txBytes.data(), txBytes.size());
                
                unsigned long numMsgs = 1;
                PassThruWriteMsgs(channelId, &txMsg, &numMsgs, 1000);
                
                PASSTHRU_MSG rxMsg = {0};
                numMsgs = 1;
                long status = PassThruReadMsgs(channelId, &rxMsg, &numMsgs, 1000);
                if (status == STATUS_NOERROR && numMsgs > 0) {
                    rxHex = BytesToHex(rxMsg.Data, rxMsg.DataSize);
                }
            } else {
                rxHex = "41 00 BF 9F E9 91"; // Mock response
            }

            json resp = {{"success", true}, {"action", "send"}, {"sent", msgHex}, {"received", rxHex}};
            s->send(hdl, resp.dump(), websocketpp::frame::opcode::text);
        }
    } catch (const std::exception& e) {
        std::cout << "Error processing message: " << e.what() << std::endl;
    }
}

int main() {
    std::cout << "======================================\\n";
    std::cout << " VCX Nano J2534 C++ WebSocket Bridge\\n";
    std::cout << "======================================\\n";
    
    // Setup DLL Path (Common paths for VCX Nano / Tactrix / Mongoose)
    if (LoadJ2534DLL("C:\\\\\\\\Program Files (x86)\\\\\\\\VCX\\\\\\\\VXDIAG\\\\\\\\J2534\\\\\\\\vxdiag.dll") || 
        LoadJ2534DLL("C:\\\\\\\\Program Files (x86)\\\\\\\\OpenECU\\\\\\\\OpenPort 2.0\\\\\\\\op20pt32.dll")) {
        std::cout << "[+] J2534 DLL Loaded Successfully.\\n";
    } else {
        std::cout << "[-] J2534 DLL Not Found. Bridge will run in simulation mode.\\n";
    }

    server print_server;
    print_server.set_access_channels(websocketpp::log::alevel::all);
    print_server.clear_access_channels(websocketpp::log::alevel::frame_payload);
    print_server.init_asio();
    print_server.set_message_handler(bind(&on_message, &print_server, std::placeholders::_1, std::placeholders::_2));
    
    std::cout << "Starting WebSocket server on ws://127.0.0.1:8080...\\n";
    print_server.listen(8080);
    print_server.start_accept();
    print_server.run();

    return 0;
}
`;
    res.setHeader('Content-Disposition', 'attachment; filename="j2534_bridge.cpp"');
    res.setHeader('Content-Type', 'text/plain');
    res.send(script);
  });

  app.post("/api/devices", (req, res) => {
    const { name, connectionType, protocol } = req.body;
    if (!name || typeof name !== 'string' || !connectionType) return res.status(400).json({ error: "Missing name or connectionType" });
    const newDevice = {
      id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name,
      connectionType,
      isConnected: false,
      protocol: null,
      savedProtocol: protocol || "ISO15765",
      baudRate: "500000",
      pins: "6/14"
    };
    devices.push(newDevice);
    res.json({ success: true, device: newDevice });
  });

  app.put("/api/devices/:id/protocol", (req, res) => {
    const device = devices.find(d => d.id === req.params.id);
    if (!device) return res.status(404).json({ error: "Device not found" });
    device.savedProtocol = req.body.protocol;
    res.json({ success: true, device });
  });

  app.post("/api/devices/:id/connect", (req, res) => {
    const device = devices.find(d => d.id === req.params.id);
    if (!device) return res.status(404).json({ error: "Device not found" });
    device.isConnected = true;
    device.protocol = req.body.protocol || device.savedProtocol || 'ISO15765';
    device.baudRate = req.body.baudRate || '500000';
    device.pins = req.body.pins || '6/14';
    device.savedProtocol = device.protocol;
    res.json({ success: true, device });
  });

  app.post("/api/devices/:id/disconnect", (req, res) => {
    const device = devices.find(d => d.id === req.params.id);
    if (!device) return res.status(404).json({ error: "Device not found" });
    device.isConnected = false;
    device.protocol = null;
    res.json({ success: true, device });
  });

  app.get("/api/status", (req, res) => {
    const active = devices.find(d => d.isConnected);
    res.json({ 
      isConnected: !!active, 
      activeDevice: active ? active.name : null, 
      activeProtocol: active ? active.protocol : null,
      baudRate: active ? active.baudRate : null,
      pins: active ? active.pins : null,
      voltage: active ? (Math.random() * 0.5 + 13.8).toFixed(1) : "0.0",
      latency: active ? Math.floor(Math.random() * 10 + 15) : 0
    });
  });

  app.get("/api/dtc", (req, res) => {
    const activeDevice = devices.find(d => d.isConnected);
    if (!activeDevice) return res.status(400).json({ error: "Not connected to a vehicle" });
    
    // Mock DTCs based on protocol
    if (activeDevice.protocol === 'J1850PWM') {
      res.json({ dtcs: [
        { code: "P1000", description: "OBD Systems Readiness Test Not Complete", status: "Stored" },
        { code: "P1260", description: "THEFT Detected, Vehicle Immobilized", status: "Pending" },
        { code: "U1262", description: "SCP (J1850) Communication Bus Fault", status: "History" }
      ] });
    } else {
      res.json({ dtcs: [
        { code: "P0102", description: "Mass or Volume Air Flow Circuit Low Input", status: "Stored" },
        { code: "P0300", description: "Random/Multiple Cylinder Misfire Detected", status: "Pending" }
      ] });
    }
  });

  const dtcDatabase: Record<string, any> = {
    "P0102": {
      code: "P0102",
      description: "Mass or Volume Air Flow Circuit Low Input",
      severity: "Moderate",
      symptoms: ["Check Engine Light ON", "Rough idle", "Decreased fuel economy", "Engine stalling"],
      causes: ["Dirty or faulty Mass Air Flow (MAF) sensor", "Vacuum leaks", "Wiring issues to the MAF sensor", "Clogged air filter"]
    },
    "P0300": {
      code: "P0300",
      description: "Random/Multiple Cylinder Misfire Detected",
      severity: "High",
      symptoms: ["Check Engine Light ON (flashing)", "Lack of power", "Hesitation during acceleration", "Rough idle"],
      causes: ["Faulty spark plugs or wires", "Defective ignition coils", "Vacuum leak", "Low fuel pressure", "Faulty fuel injectors"]
    },
    "P1000": {
      code: "P1000",
      description: "OBD Systems Readiness Test Not Complete",
      severity: "Low",
      symptoms: ["Check Engine Light ON", "Cannot pass emissions test"],
      causes: ["Battery disconnected recently", "DTCs cleared recently", "Drive cycle not completed"]
    },
    "P1260": {
      code: "P1260",
      description: "THEFT Detected, Vehicle Immobilized",
      severity: "High",
      symptoms: ["Engine cranks but will not start", "Theft indicator flashing rapidly"],
      causes: ["Unprogrammed key used", "PATS transceiver fault", "Instrument cluster or PCM fault"]
    },
    "U1262": {
      code: "U1262",
      description: "SCP (J1850) Communication Bus Fault",
      severity: "High",
      symptoms: ["Multiple warning lights ON", "Gauges dropping to zero", "No communication with scan tool"],
      causes: ["Short to ground on SCP+ or SCP-", "Short to power on SCP+ or SCP-", "Open circuit in SCP network", "Faulty module on SCP network"]
    }
  };

  app.get("/api/dtc/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const details = dtcDatabase[code];
    if (details) {
      res.json({ success: true, details });
    } else {
      res.json({ success: false, error: "Detailed information not found for this code." });
    }
  });

  app.post("/api/dtc/clear", (req, res) => {
    if (!checkAnyConnected()) return res.status(400).json({ error: "Not connected to a vehicle" });
    res.json({ success: true, message: "DTCs cleared successfully" });
  });

  app.post("/api/scan-ecus", (req, res) => {
    const activeDevice = devices.find(d => d.isConnected);
    if (!activeDevice) return res.status(400).json({ error: "Not connected to a vehicle" });
    
    // Simulate network scanning delay
    setTimeout(() => {
      let ecus = [];
      if (activeDevice.protocol === 'J1850PWM') {
        ecus = [
          { id: "0x10", name: "Powertrain Control Module (PCM)", status: "Active", protocol: "SAE J1850 PWM" },
          { id: "0x28", name: "Anti-lock Braking System (ABS)", status: "Active", protocol: "SAE J1850 PWM" },
          { id: "0x60", name: "Instrument Cluster (IC)", status: "Active", protocol: "SAE J1850 PWM" },
          { id: "0x39", name: "Generic Electronic Module (GEM)", status: "Inactive", protocol: "SAE J1850 PWM" }
        ];
      } else {
        ecus = [
          { id: "0x7E0", name: "Engine Control Module (ECM)", status: "Active", protocol: "ISO 15765-4 (CAN)" },
          { id: "0x7E1", name: "Transmission Control Module (TCM)", status: "Active", protocol: "ISO 15765-4 (CAN)" },
          { id: "0x7E8", name: "Anti-lock Braking System (ABS)", status: "Active", protocol: "ISO 15765-4 (CAN)" },
          { id: "0x7E9", name: "Body Control Module (BCM)", status: "Inactive", protocol: "ISO 15765-4 (CAN)" },
          { id: "0x7EA", name: "Supplemental Restraint System (SRS)", status: "Active", protocol: "ISO 15765-4 (CAN)" }
        ];
      }
      res.json({ success: true, ecus });
    }, 1500);
  });

  app.post("/api/vehicle-info", (req, res) => {
    const activeDevice = devices.find(d => d.isConnected);
    if (!activeDevice) return res.status(400).json({ error: "Not connected to a vehicle" });
    
    // Simulate diagnostic request delay for requesting VIN, CAL ID, etc.
    setTimeout(() => {
      let info = {};
      if (activeDevice.protocol === 'J1850PWM') {
        info = {
          vin: "1FMCU9418XUA0" + Math.floor(1000 + Math.random() * 9000), // Randomize last 4 digits
          ecuName: "Ford EEC-V PCM",
          calId: "1L2U-14A618-BA",
          protocol: "SAE J1850 PWM"
        };
      } else {
        info = {
          vin: "1HGCM82633A00" + Math.floor(1000 + Math.random() * 9000),
          ecuName: "Generic CAN ECM",
          calId: "09A7B32F",
          protocol: "ISO 15765-4 (CAN)"
        };
      }
      res.json({ success: true, info });
    }, 1200);
  });

  app.get("/api/live-data", (req, res) => {
    const activeDevice = devices.find(d => d.isConnected);
    if (!activeDevice) return res.status(400).json({ error: "Not connected to a vehicle" });
    
    // Mock live data based on protocol
    if (activeDevice.protocol === 'J1850PWM') {
      res.json({
        rpm: Math.floor(Math.random() * 1000) + 2000,
        speed: Math.floor(Math.random() * 20) + 60,
        coolantTemp: Math.floor(Math.random() * 10) + 85,
        throttle: Math.floor(Math.random() * 20) + 15,
        voltage: (Math.random() * 0.5 + 13.8).toFixed(1),
        scpErrors: Math.floor(Math.random() * 5),
        busLoad: Math.floor(Math.random() * 30) + 10,
        pwmDutyCycle: Math.floor(Math.random() * 10) + 40
      });
    } else {
      res.json({
        rpm: Math.floor(Math.random() * 1000) + 2000,
        speed: Math.floor(Math.random() * 20) + 60,
        coolantTemp: Math.floor(Math.random() * 10) + 85,
        throttle: Math.floor(Math.random() * 20) + 15,
        voltage: (Math.random() * 0.5 + 13.8).toFixed(1)
      });
    }
  });

  app.post("/api/send", (req, res) => {
    const activeDevice = devices.find(d => d.isConnected);
    if (!activeDevice) return res.status(400).json({ error: "Not connected to a vehicle" });
    const { message } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: "Missing or invalid message" });
    
    let received = "41 00 BF 9F E9 91"; // Default mock response
    
    // Mock J1850 PWM (Ford SCP) specific responses
    if (activeDevice.protocol === 'J1850PWM') {
      const msgUpper = message.toUpperCase();
      if (msgUpper.includes("22 11 00")) {
        received = "62 11 00 01 23 45"; // Mock PID response
      } else if (msgUpper.includes("18 00 00")) {
        received = "58 00 00 00"; // Mock keep alive
      } else if (msgUpper.includes("22 11 01")) {
        received = "62 11 01 4A 5B 6C"; // Mock PID response
      } else if (msgUpper.includes("22 11 02")) {
        received = "62 11 02 7D 8E 9F"; // Mock PID response
      } else if (msgUpper.includes("31 01")) {
        received = "71 01"; // Mock routine control start
      } else if (msgUpper.includes("31 02")) {
        received = "71 02"; // Mock routine control stop
      } else if (msgUpper.includes("14")) {
        received = "54"; // Mock clear DTCs
      } else if (msgUpper.includes("19 02")) {
        received = "59 02 09 01 02 03 04"; // Mock read DTCs
      } else {
        received = "41 " + message.split(" ").slice(1).join(" ") + " 00 00"; // Generic echo
      }
    }
    
    res.json({ 
      success: true, 
      sent: message,
      received: received
    });
  });

  app.post("/api/service/:action", (req, res) => {
    if (!checkAnyConnected()) return res.status(400).json({ error: "Not connected to a vehicle" });
    const { action } = req.params;
    
    // Simulate service action delay
    let delay = 2000;
    let message = `Service action ${action} completed successfully.`;
    
    if (action === 'koeo') {
      delay = 5000;
      message = "KOEO Self Test completed. No hard faults found.";
    } else if (action === 'koer') {
      delay = 8000;
      message = "KOER Self Test completed. Engine operating normally.";
    } else if (action === 'pats') {
      delay = 4000;
      message = "PATS Initialization successful. Keys programmed.";
    } else if (action === 'buzz') {
      delay = 6000;
      message = "Injector Buzz Test completed. All injectors responded.";
    }
    
    setTimeout(() => {
      res.json({ success: true, action, message });
    }, delay);
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
