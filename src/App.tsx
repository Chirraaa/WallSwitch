/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Github, Twitter, Settings } from 'lucide-react';
import { Switch } from './components/ui/switch';

interface GameConfig {
  wallpaperEnginePath: string;
  trackedGames: {
    path: string;
    name: string;
    icon: string | null;
  }[];
  autoLaunch: boolean;
  autoMonitor: boolean;
}

const App: React.FC = () => {
  const [config, setConfig] = useState<GameConfig>(() => {
    const savedConfig = localStorage.getItem('wallpaperEngineConfig');
    try {
      return savedConfig ? JSON.parse(savedConfig) : {
        wallpaperEnginePath: '',
        trackedGames: [],
        autoLaunch: false,
        autoMonitor: false
      };
    } catch (error) {
      console.error('Error parsing initial config:', error);
      return {
        wallpaperEnginePath: '',
        trackedGames: [],
        autoLaunch: false,
        autoMonitor: false
      };
    }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Comprehensive initialization effect
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('wallpaperEngineConfig');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig({
          wallpaperEnginePath: parsedConfig.wallpaperEnginePath || '',
          trackedGames: parsedConfig.trackedGames || [],
          autoLaunch: parsedConfig.autoLaunch || false,
          autoMonitor: parsedConfig.autoMonitor || false
        });
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }, []);


  // Load configuration from main process on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await window.ipcRenderer.invoke('load-config');
        if (savedConfig) {
          setConfig(savedConfig);
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
      }
    };

    loadConfig();
  }, []);

  // Save configuration whenever it changes
  useEffect(() => {
    const saveConfig = async () => {
      try {
        await window.ipcRenderer.invoke('save-config', config);
      } catch (error) {
        console.error('Error saving configuration:', error);
      }
    };

    saveConfig();
  }, [config]);
  const handleSelectWallpaperEngine = async () => {
    try {
      const result = await window.ipcRenderer.invoke('select-file', {
        title: 'Select Wallpaper Engine Executable',
        filters: [
          { name: 'Executable', extensions: ['exe'] }
        ]
      });

      console.log('Full file selection result:', result);

      if (result && !result.canceled && result.filePath) {
        setConfig(prev => ({
          ...prev,
          wallpaperEnginePath: result.filePath
        }));
      } else {
        console.log('No file was selected or selection was canceled');
      }
    } catch (error) {
      console.error('Detailed file selection error:', error);
      alert(`Error selecting file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAddGame = async () => {
    try {
      const result = await window.ipcRenderer.invoke('select-file', {
        title: 'Select Game Executable',
        filters: [
          { name: 'Executable', extensions: ['exe'] }
        ]
      });

      if (!result || result.canceled || !result.filePath) {
        return;
      }

      let iconResult = null;
      try {
        iconResult = await window.ipcRenderer.invoke('get-file-icon', result.filePath);
        console.log('ADD GAME: Icon extraction result:', {
          iconPresent: !!iconResult,
          iconLength: iconResult ? iconResult.length : 'N/A'
        });
      } catch (iconError) {
        console.warn('ADD GAME: Icon extraction failed:', iconError);
      }

      const newGame = {
        path: result.filePath,
        name: result.filePath.split('\\').pop() || 'Unknown Game',
        icon: iconResult || null
      };

      // Check for duplicates
      const isDuplicate = config.trackedGames.some(
        game => game.path === newGame.path
      );

      if (isDuplicate) {
        console.warn('ADD GAME: Duplicate game, not adding');
        return;
      }

      // Update configuration
      setConfig(prevConfig => ({
        ...prevConfig,
        trackedGames: [...prevConfig.trackedGames, newGame]
      }));

    } catch (error) {
      console.error('ADD GAME: Comprehensive error:', error);
      alert(`Error adding game: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRemoveGame = (gameToRemove: string) => {
    setConfig(prev => ({
      ...prev,
      trackedGames: prev.trackedGames.filter(game => game.path !== gameToRemove)
    }));
  };


  const handleStartStop = async () => {
    try {
      if (!isRunning) {
        if (!config.wallpaperEnginePath) {
          alert('Please select the Wallpaper Engine executable first.');
          return;
        }

        setIsRunning(true);

        const script = `
# Wallpaper Engine Game Monitoring Script
$gamesToMonitor = @{
    ${config.trackedGames.map(game => `'${game.name}' = '${game.path.split('\\').pop()}'`).join('\n  ')}
}

$wallpaperEnginePath = "${config.wallpaperEnginePath}"

function Close-WallpaperEngine {
    Get-Process -Name "wallpaper64", "wallpaper_w64", "wallpaper32" -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.Id -Force
    }
}

function Test-GameRunning {
    param([string]$GameExecutable)
    $processName = $GameExecutable -replace '\\.exe$', ''
    return (Get-Process -Name $processName -ErrorAction SilentlyContinue) -ne $null
}

function Monitor-GameStatus {
    $wallpaperEngineRunning = $false
    $lastGameState = $false

    while ($true) {
        $gameRunning = $false

        foreach ($game in $gamesToMonitor.GetEnumerator()) {
            if (Test-GameRunning -GameExecutable $game.Value) {
                $gameRunning = $true
                
                if ($wallpaperEngineRunning) {
                    Write-Host "Game detected. Closing Wallpaper Engine."
                    Close-WallpaperEngine
                    $wallpaperEngineRunning = $false
                    Start-Sleep -Seconds 2
                }
                break
            }
        }

        if (-not $gameRunning -and -not $wallpaperEngineRunning) {
            Write-Host "No games running. Starting Wallpaper Engine."
            Start-Process "$wallpaperEnginePath"
            $wallpaperEngineRunning = $true
            Start-Sleep -Seconds 5  # Give Wallpaper Engine time to start
        }

        # Use standard PowerShell if-else for logging state changes
        if ($gameRunning -ne $lastGameState) {
            if ($gameRunning) {
                Write-Host "Game started"
            } else {
                Write-Host "No games running"
            }
            $lastGameState = $gameRunning
        }

        Start-Sleep -Seconds 5
    }
}

Monitor-GameStatus
  `;

        await window.ipcRenderer.invoke('execute-powershell-script', script);

        // Minimize window after starting monitoring
        await window.ipcRenderer.invoke('hide-window');
      } else {
        // Stop monitoring
        await window.ipcRenderer.invoke('stop-powershell-script');
        setIsRunning(false);
      }
    } catch (error) {
      console.error('Start/Stop monitoring error:', error);
      setIsRunning(prevState => !prevState);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleToggleAutoLaunch = async (checked: boolean) => {
    try {
      // Send IPC to update auto-launch setting
      await window.ipcRenderer.invoke('toggle-auto-launch', checked);

      // Update local config
      setConfig(prev => ({
        ...prev,
        autoLaunch: checked
      }));
    } catch (error) {
      console.error('Error toggling auto-launch:', error);
      alert(`Failed to update auto-launch: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleToggleAutoMonitor = (checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      autoMonitor: checked
    }));
  };


  const handleOpenLink = (url: string) => {
    window.ipcRenderer.invoke('open-external-link', url);
  };


  // Render settings modal
  const renderSettingsModal = () => {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Launch at Startup</span>
                <Switch
                  checked={config.autoLaunch}
                  onCheckedChange={handleToggleAutoLaunch}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Auto Start Monitoring</span>
                <Switch
                  checked={config.autoMonitor}
                  onCheckedChange={handleToggleAutoMonitor}
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setIsSettingsOpen(false)}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };


  return (
    <div className="p-4 max-w-md mx-auto">
      <Card>
        <CardHeader className="relative">
          <CardTitle className="flex items-center justify-between">
            <span>Wallpaper Engine Game Manager</span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Open Settings"
            >
              <Settings className="h-5 w-5 text-gray-600 hover:text-gray-800" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Wallpaper Engine Path Selection */}
            <div>
              <label className="block mb-2">Wallpaper Engine Executable</label>
              <div className="flex space-x-2">
                <Input
                  value={config.wallpaperEnginePath}
                  placeholder="Select Wallpaper Engine executable"
                  readOnly
                />
                <Button variant="outline" onClick={handleSelectWallpaperEngine}>
                  Browse
                </Button>
              </div>
            </div>

            {/* Tracked Games */}
            <div>
              <label className="block mb-2">Tracked Games</label>
              <ScrollArea className="h-40 w-full rounded-md border">
                <div className="p-2">
                  {config.trackedGames.map((game, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 rounded mb-2 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center space-x-2">
                        {game.icon ? (
                          <img
                            src={`data:image/png;base64,${game.icon}`}
                            alt="Game Icon"
                            className="h-12 w-12 rounded-md object-contain"
                            onError={(e) => {
                              console.error('Icon load error', e);
                              e.currentTarget.classList.add('bg-gray-300');
                            }}
                          />
                        ) : (
                          <div className="h-8 w-8 bg-gray-300 rounded-md flex items-center justify-center">
                            <span className="text-xs text-gray-600">No Icon</span>
                          </div>
                        )}
                        <span className="truncate max-w-[200px] font-medium">{game.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGame(game.path)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button
                variant="secondary"
                className="w-full mt-2"
                onClick={handleAddGame}
              >
                Add Game
              </Button>
            </div>

            {/* Start/Stop Button */}
            <Button
              className="w-full"
              onClick={handleStartStop}
              variant={isRunning ? "destructive" : "default"}
              disabled={config.trackedGames.length === 0}
            >
              {isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <div className="flex justify-center mt-4 space-x-4">
        <button
          onClick={() => handleOpenLink('https://github.com/Chirraaa/WallSwitch')}
          className="hover:opacity-75 transition-opacity"
        >
          <Github size={24} />
        </button>
        <button
          onClick={() => handleOpenLink('https://twitter.com/ChirraaaB')}
          className="hover:opacity-75 transition-opacity"
        >
          <Twitter size={24} />
        </button>
      </div>

      {/* Settings Modal */}
      {renderSettingsModal()}
    </div>
  );
}

export default App;