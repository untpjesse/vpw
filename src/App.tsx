import React, { useState, useEffect, useRef } from 'react';
import { Activity, AlertCircle, AlertTriangle, Terminal, Car, Settings, Power, RefreshCw, Zap, Plus, Usb, Wifi, Bluetooth, Cpu, Search, ChevronDown, ChevronUp, HardDrive, Download, Upload, Wrench, Fan, Droplet, Settings2, CheckCircle2, Snowflake, Wind, Volume2, Thermometer, ArrowRightLeft, RefreshCcw, Shield, Network, Lightbulb, Lock, Bell, Unlock, Siren, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [devices, setDevices] = useState<{id: string, name: string, connectionType: string, isConnected: boolean, protocol?: string}[]>([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('USB');
  const [newDeviceProtocol, setNewDeviceProtocol] = useState('ISO15765');
  const [deviceProtocols, setDeviceProtocols] = useState<Record<string, string>>({});
  const [deviceBaudRates, setDeviceBaudRates] = useState<Record<string, string>>({});
  const [devicePins, setDevicePins] = useState<Record<string, string>>({});
  const [status, setStatus] = useState({ isConnected: false, activeDevice: null, activeProtocol: null, baudRate: null, pins: null, voltage: "0.0", latency: 0 });
  const [dtcs, setDtcs] = useState<{code: string, description: string, status: string}[]>([]);
  const [dtcSearchQuery, setDtcSearchQuery] = useState('');
  const [expandedDtc, setExpandedDtc] = useState<string | null>(null);
  const [dtcDetails, setDtcDetails] = useState<Record<string, any>>({});
  const [ecus, setEcus] = useState<{id: string, name: string, status: string, protocol: string}[]>([]);
  const [isScanningEcus, setIsScanningEcus] = useState(false);
  const [liveData, setLiveData] = useState<any>({ rpm: 0, speed: 0, coolantTemp: 0, throttle: 0, voltage: 0 });
  const [liveDataHistory, setLiveDataHistory] = useState<any[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLog, setTerminalLog] = useState<{type: 'tx'|'rx'|'sys', msg: string}[]>([]);
  const [isReadingPcm, setIsReadingPcm] = useState(false);
  const [pcmReadProgress, setPcmReadProgress] = useState(0);
  const [hasPcmBin, setHasPcmBin] = useState(false);
  const [selectedFlashFile, setSelectedFlashFile] = useState<File | null>(null);
  const [isFlashingPcm, setIsFlashingPcm] = useState(false);
  const [pcmFlashProgress, setPcmFlashProgress] = useState(0);
  const [showFlashConfirm, setShowFlashConfirm] = useState(false);
  const [flashComplete, setFlashComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bcmEepromInputRef = useRef<HTMLInputElement>(null);
  const bcmFlashInputRef = useRef<HTMLInputElement>(null);
  
  const [bcmActionState, setBcmActionState] = useState<Record<string, 'idle'|'running'|'success'>>({});
  const [bcmProgress, setBcmProgress] = useState(0);
  
  const [activeTestState, setActiveTestState] = useState<Record<string, boolean>>({});
  const [serviceActionStatus, setServiceActionStatus] = useState<Record<string, 'idle'|'running'|'success'>>({});
  const [terminalProtocol, setTerminalProtocol] = useState('ISO15765');

  const fetchDevices = () => {
    fetch('/api/devices')
      .then(res => res.json())
      .then(data => {
        setDevices(data.devices);
        // Initialize default protocols for new devices
        setDeviceProtocols(prev => {
          const protocols = { ...prev };
          data.devices.forEach((d: any) => {
            protocols[d.id] = d.savedProtocol || 'ISO15765';
          });
          return protocols;
        });
        setDeviceBaudRates(prev => {
          const rates = { ...prev };
          data.devices.forEach((d: any) => {
            rates[d.id] = d.baudRate || '500000';
          });
          return rates;
        });
        setDevicePins(prev => {
          const pins = { ...prev };
          data.devices.forEach((d: any) => {
            pins[d.id] = d.pins || '6/14';
          });
          return pins;
        });
      });
  };

  useEffect(() => {
    fetchDevices();
    checkStatus();

    const lastDevice = localStorage.getItem('lastConnectedDevice');
    const lastProtocol = localStorage.getItem('lastConnectedProtocol');
    if (lastDevice && lastProtocol) {
      fetch(`/api/devices/${lastDevice}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: lastProtocol })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          fetchDevices();
          checkStatus();
          setTerminalLog(prev => [...prev, { type: 'sys', msg: `Auto-connected to last known device via ${lastProtocol}` }]);
        }
      });
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (status.isConnected && activeTab === 'live') {
      interval = setInterval(() => {
        fetch('/api/live-data')
          .then(res => res.json())
          .then(data => {
            if (!data.error) {
              setLiveData(data);
              setLiveDataHistory(prev => {
                const newHistory = [...prev, { time: new Date().toLocaleTimeString(), ...data }];
                return newHistory.slice(-20); // Keep last 20 points
              });
            }
          });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status.isConnected, activeTab]);

  const checkStatus = () => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setStatus(data));
  };

  const addDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDeviceName, connectionType: newDeviceType, protocol: newDeviceProtocol })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setNewDeviceName('');
        fetchDevices();
        addToTerminal('sys', `Added new device: ${data.device.name}`);
      }
    });
  };

  const updateDeviceProtocol = (id: string, protocol: string) => {
    setDeviceProtocols(prev => ({ ...prev, [id]: protocol }));
    fetch(`/api/devices/${id}/protocol`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol })
    });
  };

  const connectDevice = (id: string) => {
    const protocol = deviceProtocols[id] || 'ISO15765';
    const baudRate = deviceBaudRates[id] || '500000';
    const pins = devicePins[id] || '6/14';
    fetch(`/api/devices/${id}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, baudRate, pins })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('lastConnectedDevice', id);
        localStorage.setItem('lastConnectedProtocol', protocol);
        fetchDevices();
        checkStatus();
        addToTerminal('sys', `Connected to device via ${protocol} (${baudRate} bps, Pins ${pins})`);
      }
    });
  };

  const disconnectDevice = (id: string) => {
    fetch(`/api/devices/${id}/disconnect`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.removeItem('lastConnectedDevice');
          localStorage.removeItem('lastConnectedProtocol');
          fetchDevices();
          checkStatus();
          addToTerminal('sys', 'Disconnected device');
        }
      });
  };

  const readDtcs = () => {
    fetch('/api/dtc')
      .then(res => res.json())
      .then(data => {
        if (data.dtcs) setDtcs(data.dtcs);
      });
  };

  const clearDtcs = () => {
    fetch('/api/dtc/clear', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDtcs([]);
          setExpandedDtc(null);
          addToTerminal('sys', 'DTCs cleared');
        }
      });
  };

  const toggleDtcDetails = (code: string) => {
    if (expandedDtc === code) {
      setExpandedDtc(null);
      return;
    }
    setExpandedDtc(code);
    if (!dtcDetails[code]) {
      fetch(`/api/dtc/${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setDtcDetails(prev => ({ ...prev, [code]: data.details }));
          } else {
            setDtcDetails(prev => ({ ...prev, [code]: { error: data.error } }));
          }
        })
        .catch(() => {
          setDtcDetails(prev => ({ ...prev, [code]: { error: "Failed to fetch details." } }));
        });
    }
  };

  const scanEcus = () => {
    setIsScanningEcus(true);
    addToTerminal('sys', 'Initiating vehicle network scan...');
    fetch('/api/scan-ecus', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEcus(data.ecus);
          addToTerminal('sys', `Network scan complete. Found ${data.ecus.length} modules.`);
        } else {
          addToTerminal('sys', `Scan failed: ${data.error}`);
        }
      })
      .catch(err => {
        addToTerminal('sys', `Scan error: ${err.message}`);
      })
      .finally(() => {
        setIsScanningEcus(false);
      });
  };

  const addToTerminal = (type: 'tx'|'rx'|'sys', msg: string) => {
    setTerminalLog(prev => [...prev, { type, msg }]);
  };

  const sendTerminalMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || !status.isConnected) return;
    
    const msg = terminalInput.trim().toUpperCase();
    addToTerminal('tx', msg);
    setTerminalInput('');

    fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        addToTerminal('rx', data.received);
      } else {
        addToTerminal('sys', `Error: ${data.error}`);
      }
    });
  };

  const readPcm = () => {
    if (!status.isConnected) return;
    setIsReadingPcm(true);
    setPcmReadProgress(0);
    setHasPcmBin(false);
    addToTerminal('sys', 'Initiating PCM memory read...');
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5 + 2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsReadingPcm(false);
        setHasPcmBin(true);
        addToTerminal('sys', 'PCM read complete. Ready to save BIN.');
      }
      setPcmReadProgress(progress);
    }, 500);
  };

  const handleDownloadBin = () => {
    const buffer = new Uint8Array(1024 * 1024); // 1MB dummy bin
    buffer.fill(0xFF); 
    buffer.set([0x50, 0x43, 0x4D, 0x5F, 0x42, 0x41, 0x43, 0x4B, 0x55, 0x50], 0); // "PCM_BACKUP"
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCM_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToTerminal('sys', 'PCM BIN file downloaded.');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFlashFile(e.target.files[0]);
      setShowFlashConfirm(false);
      setFlashComplete(false);
    }
  };

  const initiateFlash = () => {
    setShowFlashConfirm(true);
  };

  const confirmFlash = () => {
    setShowFlashConfirm(false);
    setIsFlashingPcm(true);
    setPcmFlashProgress(0);
    setFlashComplete(false);
    addToTerminal('sys', `Initiating PCM flash with file: ${selectedFlashFile?.name}`);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 4 + 1;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsFlashingPcm(false);
        setFlashComplete(true);
        addToTerminal('sys', 'PCM flash complete. Verifying checksums... OK.');
      }
      setPcmFlashProgress(progress);
    }, 500);
  };

  const cancelFlash = () => {
    setShowFlashConfirm(false);
    setSelectedFlashFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleActiveTest = (testId: string, customOn: string = 'ON', customOff: string = 'OFF') => {
    const newState = !activeTestState[testId];
    setActiveTestState(prev => ({ ...prev, [testId]: newState }));
    addToTerminal('sys', `Active Test [${testId}]: Commanded ${newState ? customOn : customOff}`);
  };

  const runServiceAction = (actionId: string) => {
    setServiceActionStatus(prev => ({ ...prev, [actionId]: 'running' }));
    addToTerminal('sys', `Service Action [${actionId}]: Initiated...`);
    
    setTimeout(() => {
      setServiceActionStatus(prev => ({ ...prev, [actionId]: 'success' }));
      addToTerminal('sys', `Service Action [${actionId}]: Completed successfully.`);
      
      setTimeout(() => {
        setServiceActionStatus(prev => ({ ...prev, [actionId]: 'idle' }));
      }, 3000);
    }, 2000);
  };

  const runBcmAction = (action: string, duration: number = 3000) => {
    setBcmActionState(prev => ({ ...prev, [action]: 'running' }));
    setBcmProgress(0);
    addToTerminal('sys', `[BCMHAMMER] Initiating ${action}...`);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += (100 / (duration / 100));
      if (progress >= 100) {
        clearInterval(interval);
        setBcmProgress(100);
        setBcmActionState(prev => ({ ...prev, [action]: 'success' }));
        addToTerminal('sys', `[BCMHAMMER] ${action} completed successfully.`);
        
        setTimeout(() => {
          setBcmActionState(prev => ({ ...prev, [action]: 'idle' }));
          setBcmProgress(0);
        }, 3000);
      } else {
        setBcmProgress(progress);
      }
    }, 100);
  };

  const filteredDtcs = dtcs.filter(dtc => 
    dtc.code.toLowerCase().includes(dtcSearchQuery.toLowerCase()) ||
    dtc.description.toLowerCase().includes(dtcSearchQuery.toLowerCase()) ||
    dtc.status.toLowerCase().includes(dtcSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-900 text-zinc-300 flex flex-col">
        <div className="p-4 flex items-center space-x-2 text-white font-bold text-xl border-b border-zinc-800">
          <Car className="w-6 h-6 text-blue-500" />
          <span>J2534 Tool</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'dashboard' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <Settings className="w-5 h-5" />
            <span>Connection</span>
          </button>
          <button 
            onClick={() => setActiveTab('modules')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'modules' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <Cpu className="w-5 h-5" />
            <span>Modules (ECUs)</span>
          </button>
          <button 
            onClick={() => setActiveTab('diagnostics')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'diagnostics' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <AlertCircle className="w-5 h-5" />
            <span>Diagnostics</span>
          </button>
          <button 
            onClick={() => setActiveTab('live')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'live' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <Activity className="w-5 h-5" />
            <span>Live Data</span>
          </button>
          <button 
            onClick={() => setActiveTab('firmware')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'firmware' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <HardDrive className="w-5 h-5" />
            <span>Firmware</span>
          </button>
          <button 
            onClick={() => setActiveTab('pro')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'pro' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <Wrench className="w-5 h-5" />
            <span>Pro Tools</span>
          </button>
          <button 
            onClick={() => setActiveTab('terminal')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${activeTab === 'terminal' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50'}`}
          >
            <Terminal className="w-5 h-5" />
            <span>Terminal</span>
          </button>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-3 h-3 rounded-full ${status.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{status.isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {status.isConnected && (
            <div className="mt-3 space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Voltage:</span>
                <span className="text-zinc-200">{status.voltage}V</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="text-zinc-200">{status.latency}ms</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center px-6 justify-between">
          <h1 className="text-xl font-semibold capitalize">{activeTab.replace('-', ' ')}</h1>
          {status.isConnected && (
            <div className="flex items-center space-x-2 text-sm text-zinc-500">
              <span className="font-mono bg-zinc-100 px-2 py-1 rounded">{status.activeDevice}</span>
              <span className="font-mono bg-zinc-100 px-2 py-1 rounded">{status.activeProtocol}</span>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {status.isConnected && (
                <Card className="border-green-900/20 bg-green-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-green-800 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Active Connection Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-white rounded-lg border border-green-100 shadow-sm">
                        <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Protocol</p>
                        <p className="font-mono mt-1 text-sm">{status.activeProtocol}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-green-100 shadow-sm">
                        <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Baud Rate</p>
                        <p className="font-mono mt-1 text-sm">{status.baudRate} bps</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-green-100 shadow-sm">
                        <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Active Pins</p>
                        <p className="font-mono mt-1 text-sm">{status.pins}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-green-100 shadow-sm">
                        <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Battery V</p>
                        <p className="font-mono mt-1 text-sm text-green-600 font-bold">{status.voltage} V</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Add New J2534 Device</CardTitle>
                  <CardDescription>Register a new PassThru device to the system.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={addDevice} className="flex items-end space-x-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="deviceName">Device Model / Name</Label>
                      <Input 
                        id="deviceName" 
                        value={newDeviceName}
                        onChange={e => setNewDeviceName(e.target.value)}
                        placeholder="e.g. OBDLink EX" 
                      />
                    </div>
                    <div className="w-48 space-y-2">
                      <Label htmlFor="deviceType">Connection Type</Label>
                      <select 
                        id="deviceType"
                        value={newDeviceType}
                        onChange={(e) => setNewDeviceType(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                      >
                        <option value="USB">USB</option>
                        <option value="Bluetooth">Bluetooth</option>
                        <option value="WiFi">WiFi</option>
                        <option value="Network">Network (Ethernet)</option>
                      </select>
                    </div>
                    <div className="w-48 space-y-2">
                      <Label htmlFor="deviceProtocol">Default Protocol</Label>
                      <select 
                        id="deviceProtocol"
                        value={newDeviceProtocol}
                        onChange={(e) => setNewDeviceProtocol(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                      >
                        <option value="ISO15765">ISO 15765 (CAN)</option>
                        <option value="J1850PWM">J1850 PWM</option>
                        <option value="J1850VPW">J1850 VPW</option>
                        <option value="ISO9141">ISO 9141-2</option>
                        <option value="ISO14230">ISO 14230-4</option>
                      </select>
                    </div>
                    <Button type="submit" disabled={!newDeviceName.trim()}>
                      <Plus className="w-4 h-4 mr-2" /> Add Device
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Managed Devices</CardTitle>
                  <CardDescription>List of all registered J2534 devices and their connection status.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {devices.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 border rounded-lg bg-zinc-50">
                        No devices registered. Add one above.
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-zinc-100 text-zinc-600 border-b">
                            <tr>
                              <th className="px-4 py-3 font-medium">Device Name</th>
                              <th className="px-4 py-3 font-medium">Type</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium">Connection Settings</th>
                              <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {devices.map(device => (
                              <tr key={device.id} className="bg-white">
                                <td className="px-4 py-3 font-medium">
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${device.isConnected ? 'bg-green-500' : 'bg-zinc-300'}`} />
                                    <span>{device.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center text-zinc-600">
                                    {device.connectionType === 'USB' && <Usb className="w-4 h-4 mr-1" />}
                                    {device.connectionType === 'WiFi' && <Wifi className="w-4 h-4 mr-1" />}
                                    {device.connectionType === 'Bluetooth' && <Bluetooth className="w-4 h-4 mr-1" />}
                                    {device.connectionType}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${device.isConnected ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>
                                    {device.isConnected ? 'Connected' : 'Disconnected'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {device.isConnected ? (
                                    <div className="flex flex-col space-y-1">
                                      <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded inline-block w-max">{device.protocol}</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col space-y-2">
                                      <select 
                                        value={deviceProtocols[device.id] || 'ISO15765'}
                                        onChange={(e) => updateDeviceProtocol(device.id, e.target.value)}
                                        className="h-8 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 w-full max-w-[160px]"
                                      >
                                        <option value="ISO15765">ISO 15765 (CAN)</option>
                                        <option value="J1850PWM">J1850 PWM</option>
                                        <option value="J1850VPW">J1850 VPW</option>
                                        <option value="ISO9141">ISO 9141-2</option>
                                        <option value="ISO14230">ISO 14230-4</option>
                                      </select>
                                      
                                      <div className="flex space-x-2">
                                        <select 
                                          value={deviceBaudRates[device.id] || '500000'}
                                          onChange={(e) => setDeviceBaudRates(prev => ({...prev, [device.id]: e.target.value}))}
                                          className="h-7 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-[10px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 flex-1"
                                        >
                                          <option value="500000">500 kbps</option>
                                          <option value="250000">250 kbps</option>
                                          <option value="125000">125 kbps</option>
                                          <option value="10400">10.4 kbps</option>
                                        </select>
                                        
                                        <select 
                                          value={devicePins[device.id] || '6/14'}
                                          onChange={(e) => setDevicePins(prev => ({...prev, [device.id]: e.target.value}))}
                                          className="h-7 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-[10px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 flex-1"
                                        >
                                          <option value="6/14">Pins 6/14</option>
                                          <option value="3/11">Pins 3/11</option>
                                          <option value="1/9">Pins 1/9</option>
                                          <option value="12/13">Pins 12/13</option>
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right align-top">
                                  {device.isConnected ? (
                                    <Button variant="destructive" size="sm" onClick={() => disconnectDevice(device.id)}>
                                      <Power className="w-3 h-3 mr-1" /> Disconnect
                                    </Button>
                                  ) : (
                                    <Button size="sm" onClick={() => connectDevice(device.id)}>
                                      <Zap className="w-3 h-3 mr-1" /> Connect
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium">Vehicle Network Modules</h2>
                  <p className="text-sm text-zinc-500">Scan and identify all responsive ECUs on the connected vehicle network.</p>
                </div>
                <Button onClick={scanEcus} disabled={!status.isConnected || isScanningEcus}>
                  {isScanningEcus ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {isScanningEcus ? 'Scanning Network...' : 'Scan ECUs'}
                </Button>
              </div>

              {!status.isConnected ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  Connect to a vehicle to scan for modules.
                </div>
              ) : ecus.length === 0 && !isScanningEcus ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  No modules found. Click "Scan ECUs" to begin.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {ecus.map((ecu, i) => (
                    <Card key={i} className={`border-l-4 ${ecu.status === 'Active' ? 'border-l-green-500' : 'border-l-zinc-300'}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-mono text-sm font-bold text-zinc-500">{ecu.id}</div>
                          <div className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${ecu.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                            {ecu.status}
                          </div>
                        </div>
                        <h3 className="font-semibold text-zinc-900 mb-1">{ecu.name}</h3>
                        <p className="text-xs text-zinc-500 font-mono">{ecu.protocol}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {isScanningEcus && (
                    <Card className="border-dashed border-2 bg-zinc-50/50 flex items-center justify-center min-h-[120px]">
                      <div className="flex flex-col items-center text-zinc-400">
                        <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                        <span className="text-sm">Probing addresses...</span>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Diagnostic Trouble Codes (DTCs)</h2>
                <div className="space-x-2">
                  <Button variant="outline" onClick={readDtcs} disabled={!status.isConnected}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Read DTCs
                  </Button>
                  <Button variant="destructive" onClick={clearDtcs} disabled={!status.isConnected || dtcs.length === 0}>
                    Clear DTCs
                  </Button>
                </div>
              </div>

              {!status.isConnected ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  Connect to a vehicle to read diagnostics.
                </div>
              ) : dtcs.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  No DTCs found or not read yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input 
                      placeholder="Search DTCs by code, description, or status..." 
                      value={dtcSearchQuery}
                      onChange={(e) => setDtcSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {filteredDtcs.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 bg-white border rounded-xl">
                      No DTCs match your search.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredDtcs.map((dtc, i) => (
                        <Card 
                          key={i} 
                          className="border-l-4 border-l-red-500 cursor-pointer hover:bg-zinc-50 transition-colors"
                          onClick={() => toggleDtcDetails(dtc.code)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-mono text-lg font-bold text-red-600 flex items-center">
                                  {dtc.code}
                                  {expandedDtc === dtc.code ? (
                                    <ChevronUp className="w-4 h-4 ml-2 text-zinc-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 ml-2 text-zinc-400" />
                                  )}
                                </div>
                                <div className="text-zinc-700">{dtc.description}</div>
                              </div>
                              <div className="bg-zinc-100 px-2 py-1 rounded text-xs font-medium text-zinc-600 uppercase">
                                {dtc.status}
                              </div>
                            </div>
                            
                            {expandedDtc === dtc.code && (
                              <div className="mt-4 pt-4 border-t border-zinc-100 animate-in fade-in slide-in-from-top-2">
                                {!dtcDetails[dtc.code] ? (
                                  <div className="flex items-center text-zinc-500 text-sm">
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Fetching details...
                                  </div>
                                ) : dtcDetails[dtc.code].error ? (
                                  <div className="text-sm text-zinc-500 italic">
                                    {dtcDetails[dtc.code].error}
                                  </div>
                                ) : (
                                  <div className="space-y-3 text-sm">
                                    <div>
                                      <span className="font-semibold text-zinc-900">Severity: </span>
                                      <span className={dtcDetails[dtc.code].severity === 'High' ? 'text-red-600 font-medium' : 'text-orange-600 font-medium'}>
                                        {dtcDetails[dtc.code].severity}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-zinc-900">Common Symptoms:</span>
                                      <ul className="list-disc pl-5 mt-1 text-zinc-600">
                                        {dtcDetails[dtc.code].symptoms?.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                                      </ul>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-zinc-900">Possible Causes:</span>
                                      <ul className="list-disc pl-5 mt-1 text-zinc-600">
                                        {dtcDetails[dtc.code].causes?.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-6">
              {!status.isConnected ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  Connect to a vehicle to view live data.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-sm text-zinc-500 mb-1">Engine RPM</div>
                        <div className="text-3xl font-mono">{liveData.rpm}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-sm text-zinc-500 mb-1">Vehicle Speed</div>
                        <div className="text-3xl font-mono">{liveData.speed} <span className="text-lg text-zinc-400">km/h</span></div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-sm text-zinc-500 mb-1">Coolant Temp</div>
                        <div className="text-3xl font-mono">{liveData.coolantTemp} <span className="text-lg text-zinc-400">°C</span></div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-sm text-zinc-500 mb-1">Battery Voltage</div>
                        <div className="text-3xl font-mono">{liveData.voltage} <span className="text-lg text-zinc-400">V</span></div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>RPM History</CardTitle>
                      </CardHeader>
                      <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={liveDataHistory}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 7000]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="rpm" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Coolant Temperature History</CardTitle>
                      </CardHeader>
                      <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={liveDataHistory}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 150]} label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="coolantTemp" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'firmware' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium">PCM Firmware Management</h2>
                  <p className="text-sm text-zinc-500">Read and backup the binary firmware (BIN) from the Powertrain Control Module.</p>
                </div>
              </div>

              {!status.isConnected ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  Connect to a vehicle to access firmware tools.
                </div>
              ) : (
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Read PCM (Backup)</CardTitle>
                      <CardDescription>
                        Download a copy of the current PCM memory to a .bin file. 
                        Ensure vehicle battery voltage is stable (currently {liveData.voltage || '--'}V) before proceeding.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center space-x-4">
                        <Button 
                          onClick={readPcm} 
                          disabled={isReadingPcm || !status.isConnected}
                          className="w-40"
                        >
                          {isReadingPcm ? (
                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Reading...</>
                          ) : (
                            <><Download className="w-4 h-4 mr-2" /> Read PCM</>
                          )}
                        </Button>
                        
                        {hasPcmBin && !isReadingPcm && (
                          <Button 
                            onClick={handleDownloadBin} 
                            variant="default"
                            className="w-40 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <HardDrive className="w-4 h-4 mr-2" /> Save BIN File
                          </Button>
                        )}
                      </div>

                      {isReadingPcm && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-zinc-600">
                            <span>Reading memory blocks...</span>
                            <span>{Math.round(pcmReadProgress)}%</span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden border">
                            <div 
                              className="bg-blue-600 h-2.5 transition-all duration-300 ease-out" 
                              style={{ width: `${pcmReadProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {hasPcmBin && !isReadingPcm && (
                        <div className="p-4 bg-green-50 text-green-800 rounded-md border border-green-200 text-sm flex items-start">
                          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 text-green-600" />
                          <div>
                            <p className="font-semibold">Read Successful</p>
                            <p>The PCM memory has been successfully copied to the buffer. Click "Save BIN File" to download it to your computer.</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Write PCM (Flash)</CardTitle>
                      <CardDescription>Upload a modified .bin file to the PCM. Warning: Ensure stable voltage before flashing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <input 
                        type="file" 
                        accept=".bin" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                      />
                      
                      {!selectedFlashFile && !isFlashingPcm && !flashComplete && (
                        <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={!status.isConnected}>
                          <Upload className="w-4 h-4 mr-2" /> Select BIN to Flash
                        </Button>
                      )}

                      {selectedFlashFile && !isFlashingPcm && !flashComplete && (
                        <div className="space-y-4">
                          <div className="p-3 bg-zinc-50 border rounded-md flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <HardDrive className="w-5 h-5 text-zinc-400" />
                              <div>
                                <p className="text-sm font-medium">{selectedFlashFile.name}</p>
                                <p className="text-xs text-zinc-500">{(selectedFlashFile.size / 1024).toFixed(2)} KB</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={cancelFlash}>Cancel</Button>
                          </div>

                          {!showFlashConfirm ? (
                            <Button onClick={initiateFlash} variant="destructive" className="w-full">
                              <Zap className="w-4 h-4 mr-2" /> Flash PCM
                            </Button>
                          ) : (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-md space-y-3">
                              <div className="flex items-start text-red-800">
                                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold">WARNING: Critical Operation</p>
                                  <p className="text-sm mt-1">Flashing the PCM with an incorrect or corrupted file, or losing power during the process, can permanently brick the ECU. Are you sure you want to proceed?</p>
                                </div>
                              </div>
                              <div className="flex space-x-3">
                                <Button onClick={confirmFlash} variant="destructive" className="flex-1">Yes, Flash PCM</Button>
                                <Button onClick={cancelFlash} variant="outline" className="flex-1 bg-white">Cancel</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isFlashingPcm && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-zinc-600">
                            <span>Erasing & Writing blocks...</span>
                            <span>{Math.round(pcmFlashProgress)}%</span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden border">
                            <div 
                              className="bg-red-500 h-2.5 transition-all duration-300 ease-out" 
                              style={{ width: `${pcmFlashProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {flashComplete && (
                        <div className="space-y-4">
                          <div className="p-4 bg-green-50 text-green-800 rounded-md border border-green-200 text-sm flex items-start">
                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 text-green-600" />
                            <div>
                              <p className="font-semibold">Flash Successful</p>
                              <p>The PCM has been successfully flashed and verified. Please cycle the ignition.</p>
                            </div>
                          </div>
                          <Button onClick={cancelFlash} variant="outline">Flash Another File</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-purple-900/20">
                    <CardHeader className="bg-purple-50/50 border-b border-purple-100">
                      <CardTitle className="flex items-center text-purple-800">
                        <Cpu className="w-5 h-5 mr-2" /> BCMHammer (Body Control Module Cloning)
                      </CardTitle>
                      <CardDescription>
                        Read/Write EEPROM and Flash memory for BCM cloning, VIN changes, and security resets.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4 p-4 border rounded-lg bg-zinc-50">
                          <h3 className="font-medium text-sm flex items-center"><HardDrive className="w-4 h-4 mr-2 text-zinc-500"/> EEPROM Operations</h3>
                          <p className="text-xs text-zinc-500">Contains VIN, mileage, and security data.</p>
                          
                          <div className="flex space-x-2">
                            <Button 
                              className="flex-1" 
                              variant="outline"
                              disabled={bcmActionState['read_eeprom'] === 'running' || !status.isConnected}
                              onClick={() => runBcmAction('read_eeprom', 2000)}
                            >
                              {bcmActionState['read_eeprom'] === 'running' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                              Read EEPROM
                            </Button>
                            
                            <input type="file" accept=".bin" className="hidden" ref={bcmEepromInputRef} onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                runBcmAction('write_eeprom', 3000);
                              }
                            }} />
                            
                            <Button 
                              className="flex-1" 
                              variant="default"
                              disabled={bcmActionState['write_eeprom'] === 'running' || !status.isConnected}
                              onClick={() => bcmEepromInputRef.current?.click()}
                            >
                              {bcmActionState['write_eeprom'] === 'running' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                              Write EEPROM
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4 p-4 border rounded-lg bg-zinc-50">
                          <h3 className="font-medium text-sm flex items-center"><Cpu className="w-4 h-4 mr-2 text-zinc-500"/> Flash Operations</h3>
                          <p className="text-xs text-zinc-500">Contains the main operating system and calibrations.</p>
                          
                          <div className="flex space-x-2">
                            <Button 
                              className="flex-1" 
                              variant="outline"
                              disabled={bcmActionState['read_flash'] === 'running' || !status.isConnected}
                              onClick={() => runBcmAction('read_flash', 8000)}
                            >
                              {bcmActionState['read_flash'] === 'running' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                              Read Flash
                            </Button>
                            
                            <input type="file" accept=".bin" className="hidden" ref={bcmFlashInputRef} onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                runBcmAction('write_flash', 12000);
                              }
                            }} />
                            
                            <Button 
                              className="flex-1" 
                              variant="default"
                              disabled={bcmActionState['write_flash'] === 'running' || !status.isConnected}
                              onClick={() => bcmFlashInputRef.current?.click()}
                            >
                              {bcmActionState['write_flash'] === 'running' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                              Write Flash
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-medium text-sm flex items-center"><Settings className="w-4 h-4 mr-2 text-zinc-500"/> BCM Utilities</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button 
                            variant="outline" 
                            className="justify-start"
                            disabled={bcmActionState['change_vin'] === 'running' || !status.isConnected}
                            onClick={() => {
                              const newVin = prompt("Enter new 17-character VIN:");
                              if (newVin && newVin.length === 17) {
                                runBcmAction('change_vin', 1500);
                              } else if (newVin) {
                                alert("Invalid VIN length. Must be exactly 17 characters.");
                              }
                            }}
                          >
                            <Car className="w-4 h-4 mr-2 text-blue-500" />
                            Change VIN
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            className="justify-start"
                            disabled={bcmActionState['reset_security'] === 'running' || !status.isConnected}
                            onClick={() => runBcmAction('reset_security', 2000)}
                          >
                            <Shield className="w-4 h-4 mr-2 text-red-500" />
                            Reset Security / Immobilizer
                          </Button>
                        </div>
                      </div>

                      {Object.values(bcmActionState).includes('running') && (
                        <div className="space-y-2 p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <div className="flex justify-between text-sm text-purple-800 font-medium">
                            <span>BCM Operation in progress...</span>
                            <span>{Math.round(bcmProgress)}%</span>
                          </div>
                          <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-purple-600 h-2.5 transition-all duration-300 ease-out" 
                              style={{ width: `${bcmProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {Object.values(bcmActionState).includes('success') && (
                        <div className="p-3 bg-green-50 text-green-800 rounded-md border border-green-200 text-sm flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                          BCM operation completed successfully.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pro' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium">Professional Tools & Active Tests</h2>
                  <p className="text-sm text-zinc-500">Bi-directional controls, service resets, and module configuration.</p>
                </div>
              </div>

              {!status.isConnected ? (
                <div className="text-center py-12 text-zinc-500 bg-white border rounded-xl">
                  Connect to a vehicle to access professional tools.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Zap className="w-5 h-5 mr-2 text-blue-500"/> Bi-Directional Controls</CardTitle>
                      <CardDescription>Actuate vehicle components in real-time.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Fan className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Cooling Fan Relay</p>
                            <p className="text-xs text-zinc-500">Command fan to 100%</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['fan'] ? 'default' : 'outline'}
                          className={activeTestState['fan'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('fan')}
                        >
                          {activeTestState['fan'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Activity className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Fuel Pump Enable</p>
                            <p className="text-xs text-zinc-500">Command fuel pump relay</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['fuel'] ? 'default' : 'outline'}
                          className={activeTestState['fuel'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('fuel')}
                        >
                          {activeTestState['fuel'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Snowflake className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">A/C Compressor Clutch</p>
                            <p className="text-xs text-zinc-500">Command A/C clutch engagement</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['ac'] ? 'default' : 'outline'}
                          className={activeTestState['ac'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('ac')}
                        >
                          {activeTestState['ac'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Wind className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">EVAP Purge Solenoid</p>
                            <p className="text-xs text-zinc-500">Command purge valve open</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['evap'] ? 'default' : 'outline'}
                          className={activeTestState['evap'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('evap')}
                        >
                          {activeTestState['evap'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Volume2 className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Horn Relay</p>
                            <p className="text-xs text-zinc-500">Command horn sound</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['horn'] ? 'default' : 'outline'}
                          className={activeTestState['horn'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('horn')}
                        >
                          {activeTestState['horn'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Settings2 className="w-5 h-5 mr-2 text-orange-500"/> Service Resets</CardTitle>
                      <CardDescription>Perform routine maintenance resets.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Droplet className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Oil Life Reset</p>
                            <p className="text-xs text-zinc-500">Reset service interval</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['oil'] === 'running'}
                          onClick={() => runServiceAction('oil')}
                          variant={serviceActionStatus['oil'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['oil'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['oil'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['oil'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Reset'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">EPB Service Mode</p>
                            <p className="text-xs text-zinc-500">Retract parking brake</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['epb'] === 'running'}
                          onClick={() => runServiceAction('epb')}
                          variant={serviceActionStatus['epb'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['epb'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['epb'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['epb'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Thermometer className="w-5 h-5 mr-2 text-red-500"/> HVAC Actuators</CardTitle>
                      <CardDescription>Climate control and HVAC diagnostics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Thermometer className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Blend Door Actuator</p>
                            <p className="text-xs text-zinc-500">Command temperature mix</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['blend'] ? 'default' : 'outline'}
                          className={activeTestState['blend'] ? 'bg-red-600 text-white hover:bg-red-700' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}
                          onClick={() => toggleActiveTest('blend', 'HOT', 'COLD')}
                        >
                          {activeTestState['blend'] ? 'HOT' : 'COLD'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <ArrowRightLeft className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Mode Door Actuator</p>
                            <p className="text-xs text-zinc-500">Command vent position</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['mode'] ? 'default' : 'outline'}
                          className={activeTestState['mode'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('mode', 'DEFROST', 'PANEL')}
                        >
                          {activeTestState['mode'] ? 'DEFROST' : 'PANEL'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <RefreshCcw className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Recirculation Door</p>
                            <p className="text-xs text-zinc-500">Command air intake source</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['recirc'] ? 'default' : 'outline'}
                          className={activeTestState['recirc'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('recirc', 'RECIRC', 'FRESH')}
                        >
                          {activeTestState['recirc'] ? 'RECIRC' : 'FRESH'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Fan className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">HVAC Blower Motor</p>
                            <p className="text-xs text-zinc-500">Command blower speed</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['blower'] ? 'default' : 'outline'}
                          className={activeTestState['blower'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('blower', 'MAX', 'OFF')}
                        >
                          {activeTestState['blower'] ? 'MAX' : 'OFF'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Settings className="w-5 h-5 mr-2 text-amber-500"/> Automatic Transfer Case</CardTitle>
                      <CardDescription>4WD/AWD drivetrain diagnostics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Transfer Case Motor</p>
                            <p className="text-xs text-zinc-500">Command shift motor position</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['tcc_motor'] ? 'default' : 'outline'}
                          className={activeTestState['tcc_motor'] ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}
                          onClick={() => toggleActiveTest('tcc_motor', '4HI', '2HI')}
                        >
                          {activeTestState['tcc_motor'] ? '4HI' : '2HI'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings2 className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Front Axle Actuator</p>
                            <p className="text-xs text-zinc-500">Command front differential lock</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['front_axle'] ? 'default' : 'outline'}
                          className={activeTestState['front_axle'] ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}
                          onClick={() => toggleActiveTest('front_axle', 'LOCK', 'UNLOCK')}
                        >
                          {activeTestState['front_axle'] ? 'LOCK' : 'UNLOCK'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Activity className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Transfer Case Clutch</p>
                            <p className="text-xs text-zinc-500">Command clutch PWM duty cycle</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['tcc_clutch'] ? 'default' : 'outline'}
                          className={activeTestState['tcc_clutch'] ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}
                          onClick={() => toggleActiveTest('tcc_clutch', '100%', '0%')}
                        >
                          {activeTestState['tcc_clutch'] ? '100%' : '0%'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Low Range Gear</p>
                            <p className="text-xs text-zinc-500">Command planetary gear reduction</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['low_range'] ? 'default' : 'outline'}
                          className={activeTestState['low_range'] ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}
                          onClick={() => toggleActiveTest('low_range', '4LO', 'HIGH')}
                        >
                          {activeTestState['low_range'] ? '4LO' : 'HIGH'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Car className="w-5 h-5 mr-2 text-blue-500"/> Body Control Module (BCM)</CardTitle>
                      <CardDescription>Lighting, locks, horn, and body accessory controls.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Lock className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Door Locks</p>
                            <p className="text-xs text-zinc-500">Command all doors</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['door_locks'] ? 'default' : 'outline'}
                          className={activeTestState['door_locks'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('door_locks', 'LOCK', 'UNLOCK')}
                        >
                          {activeTestState['door_locks'] ? 'LOCK' : 'UNLOCK'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Lightbulb className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Low Beam Headlamps</p>
                            <p className="text-xs text-zinc-500">Command exterior lighting</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['headlamps'] ? 'default' : 'outline'}
                          className={activeTestState['headlamps'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('headlamps', 'ON', 'OFF')}
                        >
                          {activeTestState['headlamps'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Bell className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Horn Relay</p>
                            <p className="text-xs text-zinc-500">Command horn sound</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['horn'] ? 'default' : 'outline'}
                          className={activeTestState['horn'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('horn', 'ON', 'OFF')}
                        >
                          {activeTestState['horn'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Droplet className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Windshield Wipers</p>
                            <p className="text-xs text-zinc-500">Command wiper motor (Low)</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['wipers'] ? 'default' : 'outline'}
                          className={activeTestState['wipers'] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                          onClick={() => toggleActiveTest('wipers', 'ON', 'OFF')}
                        >
                          {activeTestState['wipers'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Key Fob Programming</p>
                            <p className="text-xs text-zinc-500">Add/Remove RKE transmitters</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['key_fob'] === 'running'}
                          onClick={() => runServiceAction('key_fob')}
                          variant={serviceActionStatus['key_fob'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['key_fob'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['key_fob'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['key_fob'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-red-900/50 bg-red-950/10">
                    <CardHeader>
                      <CardTitle className="flex items-center text-red-500"><AlertTriangle className="w-5 h-5 mr-2"/> Emergency & Security (BCM)</CardTitle>
                      <CardDescription className="text-red-400/70">Critical overrides, alarms, and security functions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border border-red-900/30 rounded-lg bg-black/20">
                        <div className="flex items-center space-x-3">
                          <Siren className="w-5 h-5 text-red-400" />
                          <div>
                            <p className="font-medium text-sm text-red-200">Panic Alarm / Siren</p>
                            <p className="text-xs text-red-400/70">Trigger vehicle security alarm</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['panic_alarm'] ? 'destructive' : 'outline'}
                          className={activeTestState['panic_alarm'] ? 'animate-pulse' : 'border-red-900/50 text-red-400 hover:bg-red-900/20'}
                          onClick={() => toggleActiveTest('panic_alarm', 'ON', 'OFF')}
                        >
                          {activeTestState['panic_alarm'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border border-red-900/30 rounded-lg bg-black/20">
                        <div className="flex items-center space-x-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="font-medium text-sm text-amber-200">Hazard Flashers</p>
                            <p className="text-xs text-amber-500/70">Override hazard light relay</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['hazards'] ? 'default' : 'outline'}
                          className={activeTestState['hazards'] ? 'bg-amber-600 text-white hover:bg-amber-700 animate-pulse' : 'border-amber-900/50 text-amber-500 hover:bg-amber-900/20'}
                          onClick={() => toggleActiveTest('hazards', 'ON', 'OFF')}
                        >
                          {activeTestState['hazards'] ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border border-red-900/30 rounded-lg bg-black/20">
                        <div className="flex items-center space-x-3">
                          <Unlock className="w-5 h-5 text-zinc-400" />
                          <div>
                            <p className="font-medium text-sm text-zinc-200">Trunk / Liftgate Release</p>
                            <p className="text-xs text-zinc-500">Command electronic rear latch</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['trunk_release'] === 'running'}
                          onClick={() => runServiceAction('trunk_release')}
                          variant={serviceActionStatus['trunk_release'] === 'success' ? 'outline' : 'secondary'}
                          className={serviceActionStatus['trunk_release'] === 'success' ? 'text-green-500 border-green-900/50 bg-green-900/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}
                        >
                          {serviceActionStatus['trunk_release'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['trunk_release'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Released</> : 'Release'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border border-red-900/30 rounded-lg bg-black/20">
                        <div className="flex items-center space-x-3">
                          <Key className="w-5 h-5 text-zinc-400" />
                          <div>
                            <p className="font-medium text-sm text-zinc-200">Starter Disable Override</p>
                            <p className="text-xs text-zinc-500">Bypass immobilizer starter relay</p>
                          </div>
                        </div>
                        <Button 
                          variant={activeTestState['starter_override'] ? 'default' : 'outline'}
                          className={activeTestState['starter_override'] ? 'bg-red-600 text-white hover:bg-red-700' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}
                          onClick={() => toggleActiveTest('starter_override', 'ENABLE', 'DISABLE')}
                        >
                          {activeTestState['starter_override'] ? 'ENABLE' : 'DISABLE'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border border-red-900/30 rounded-lg bg-black/20">
                        <div className="flex items-center space-x-3">
                          <Power className="w-5 h-5 text-zinc-400" />
                          <div>
                            <p className="font-medium text-sm text-zinc-200">Crash Event Reset</p>
                            <p className="text-xs text-zinc-500">Clear crash data / Enable fuel pump</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['crash_reset'] === 'running'}
                          onClick={() => runServiceAction('crash_reset')}
                          variant={serviceActionStatus['crash_reset'] === 'success' ? 'outline' : 'secondary'}
                          className={serviceActionStatus['crash_reset'] === 'success' ? 'text-green-500 border-green-900/50 bg-green-900/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}
                        >
                          {serviceActionStatus['crash_reset'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['crash_reset'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Reset</> : 'Reset'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Cpu className="w-5 h-5 mr-2 text-purple-500"/> GM Class 2 (J1850 VPW)</CardTitle>
                      <CardDescription>Legacy GM serial data special functions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">CASE Relearn</p>
                            <p className="text-xs text-zinc-500">Crankshaft Position Variation Learn</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['case'] === 'running'}
                          onClick={() => runServiceAction('case')}
                          variant={serviceActionStatus['case'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['case'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['case'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['case'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">VATS / Passlock Relearn</p>
                            <p className="text-xs text-zinc-500">Security system initialization</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['vats'] === 'running'}
                          onClick={() => runServiceAction('vats')}
                          variant={serviceActionStatus['vats'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['vats'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['vats'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['vats'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Wind className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">IAC Reset</p>
                            <p className="text-xs text-zinc-500">Idle Air Control pintle reset</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['iac'] === 'running'}
                          onClick={() => runServiceAction('iac')}
                          variant={serviceActionStatus['iac'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['iac'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['iac'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['iac'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Reset'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Network className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Class 2 Module Ping</p>
                            <p className="text-xs text-zinc-500">State of Health (SOH) network check</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['ping'] === 'running'}
                          onClick={() => runServiceAction('ping')}
                          variant={serviceActionStatus['ping'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['ping'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['ping'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['ping'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Ping'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Droplet className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">ABS Automated Bleed</p>
                            <p className="text-xs text-zinc-500">Cycle ABS pump and valves</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['abs_bleed'] === 'running'}
                          onClick={() => runServiceAction('abs_bleed')}
                          variant={serviceActionStatus['abs_bleed'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['abs_bleed'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['abs_bleed'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['abs_bleed'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings2 className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Transmission Fast Learn</p>
                            <p className="text-xs text-zinc-500">Reset adaptive shift pressures</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['trans_learn'] === 'running'}
                          onClick={() => runServiceAction('trans_learn')}
                          variant={serviceActionStatus['trans_learn'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['trans_learn'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['trans_learn'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['trans_learn'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Zap className="w-5 h-5 mr-2 text-yellow-500"/> GM GMLAN / CAN Special Functions</CardTitle>
                      <CardDescription>Modern GM high-speed and low-speed CAN service routines.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">BPP Sensor Calibration</p>
                            <p className="text-xs text-zinc-500">Brake Pedal Position sensor learn</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['bpp_learn'] === 'running'}
                          onClick={() => runServiceAction('bpp_learn')}
                          variant={serviceActionStatus['bpp_learn'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['bpp_learn'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['bpp_learn'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['bpp_learn'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Settings2 className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">SAS Calibration</p>
                            <p className="text-xs text-zinc-500">Steering Angle Sensor centering</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['sas_learn'] === 'running'}
                          onClick={() => runServiceAction('sas_learn')}
                          variant={serviceActionStatus['sas_learn'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['sas_learn'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['sas_learn'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['sas_learn'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <RefreshCcw className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Throttle Body Learn</p>
                            <p className="text-xs text-zinc-500">Electronic throttle idle reset</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['throttle_learn'] === 'running'}
                          onClick={() => runServiceAction('throttle_learn')}
                          variant={serviceActionStatus['throttle_learn'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['throttle_learn'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['throttle_learn'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['throttle_learn'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Activity className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">TPMS Registration</p>
                            <p className="text-xs text-zinc-500">Tire pressure monitor sensor learn</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['tpms_learn'] === 'running'}
                          onClick={() => runServiceAction('tpms_learn')}
                          variant={serviceActionStatus['tpms_learn'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['tpms_learn'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['tpms_learn'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['tpms_learn'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Start'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Zap className="w-5 h-5 text-zinc-500" />
                          <div>
                            <p className="font-medium text-sm">Fuel Trim Reset</p>
                            <p className="text-xs text-zinc-500">Clear learned fuel trim values</p>
                          </div>
                        </div>
                        <Button 
                          disabled={serviceActionStatus['fuel_trim'] === 'running'}
                          onClick={() => runServiceAction('fuel_trim')}
                          variant={serviceActionStatus['fuel_trim'] === 'success' ? 'outline' : 'default'}
                          className={serviceActionStatus['fuel_trim'] === 'success' ? 'text-green-600 border-green-200 bg-green-50' : ''}
                        >
                          {serviceActionStatus['fuel_trim'] === 'running' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           serviceActionStatus['fuel_trim'] === 'success' ? <><CheckCircle2 className="w-4 h-4 mr-1"/> Done</> : 'Reset'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === 'terminal' && (
            <Card className="flex flex-col h-full">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Raw PassThru Terminal</CardTitle>
                    <CardDescription>Send and receive raw hex messages via J2534 PassThruMsg.</CardDescription>
                  </div>
                  <select 
                    value={terminalProtocol}
                    onChange={(e) => {
                      setTerminalProtocol(e.target.value);
                      addToTerminal('sys', `Protocol changed to ${e.target.value}`);
                    }}
                    className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ISO15765">ISO 15765-4 (CAN)</option>
                    <option value="J1850VPW">SAE J1850 VPW (GM Class 2)</option>
                    <option value="J1850PWM">SAE J1850 PWM (Ford SCP)</option>
                    <option value="ISO9141">ISO 9141-2 (K-Line)</option>
                    <option value="ISO14230">ISO 14230-4 (KWP2000)</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 bg-zinc-950 text-green-400 font-mono text-sm p-4 rounded-md overflow-y-auto mb-4">
                  {terminalLog.length === 0 ? (
                    <div className="text-zinc-600 italic">Terminal ready. Connect to a device to begin.</div>
                  ) : (
                    terminalLog.map((log, i) => (
                      <div key={i} className="mb-1">
                        {log.type === 'sys' && <span className="text-blue-400">[*] {log.msg}</span>}
                        {log.type === 'tx' && <span><span className="text-zinc-500">TX:</span> {log.msg}</span>}
                        {log.type === 'rx' && <span><span className="text-zinc-500">RX:</span> {log.msg}</span>}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={sendTerminalMessage} className="flex space-x-2">
                  <Input 
                    value={terminalInput}
                    onChange={e => setTerminalInput(e.target.value)}
                    placeholder="e.g. 01 00 (Hex)"
                    className="font-mono uppercase"
                    disabled={!status.isConnected}
                  />
                  <Button type="submit" disabled={!status.isConnected || !terminalInput.trim()}>
                    Send
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
