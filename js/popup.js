
function initializePopup() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const totalHidden = document.getElementById('totalHidden');
  const todayHidden = document.getElementById('todayHidden');
  const weekHidden = document.getElementById('weekHidden');
  const monthHidden = document.getElementById('monthHidden');
  const topUsersList = document.getElementById('topUsersList');
  
  let isEnabled = true;
  
  if (!toggleSwitch || !statusIndicator || !statusText) {
    console.error('Required elements not found');
    return;
  }
  
  function updateStatus(isEnabledValue) {
    if (!statusIndicator || !statusText) return;
    
    if (isEnabledValue) {
      statusIndicator.className = 'status-indicator active';
      statusText.textContent = 'Retweets are hidden';
    } else {
      statusIndicator.className = 'status-indicator inactive';
      statusText.textContent = 'Retweets are shown';
    }
  }
  
  try {
    if (chrome && chrome.storage) {
      chrome.storage.sync.get(['retweetHiderEnabled'], function(result) {
        try {
          isEnabled = result.retweetHiderEnabled !== false;
          updateToggleState(isEnabled);
          updateStatus(isEnabled);
        } catch (error) {
          console.error('Storage read error:', error);
        }
      });
    }
  } catch (error) {
    console.error('Chrome storage access error:', error);
  }
  
  loadStatistics();
  
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const resetBtn = document.getElementById('resetBtn');
  const importFile = document.getElementById('importFile');
  
  exportBtn.addEventListener('click', function() {
    try {
      if (chrome && chrome.storage) {
        chrome.storage.local.get(['retweetStats', 'userStats'], function(result) {
          const data = {
            retweetStats: result.retweetStats || {
              total: 0,
              today: 0,
              week: 0,
              month: 0
            },
            userStats: result.userStats || {},
            exportDate: new Date().toISOString()
          };
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `retweet-hider-stats-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          statusText.textContent = 'Statistics exported!';
          setTimeout(() => {
            updateStatus(isEnabled);
          }, 2000);
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      statusText.textContent = 'Export failed!';
    }
  });
  
  importBtn.addEventListener('click', function() {
    importFile.click();
  });
  
  importFile.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.retweetStats || data.userStats) {
          chrome.storage.local.set({
            retweetStats: data.retweetStats || {
              total: 0,
              today: 0,
              week: 0,
              month: 0
            },
            userStats: data.userStats || {}
          }, function() {
            loadStatistics();
            statusText.textContent = 'Statistics imported!';
            setTimeout(() => {
              updateStatus(isEnabled);
            }, 2000);
          });
        }
      } catch (error) {
        console.error('Import error:', error);
        statusText.textContent = 'Import failed! Invalid file.';
      }
    };
    reader.readAsText(file);
    
    e.target.value = '';
  });
  
  resetBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
      chrome.storage.local.set({
        retweetStats: {
          total: 0,
          today: 0,
          week: 0,
          month: 0,
          lastUpdate: {}
        },
        userStats: {}
      }, function() {
        loadStatistics();
        statusText.textContent = 'Statistics reset!';
        setTimeout(() => {
          updateStatus(isEnabled);
        }, 2000);
      });
    }
  });
  
  toggleSwitch.addEventListener('click', function() {
    try {
      if (chrome && chrome.storage) {
        chrome.storage.sync.get(['retweetHiderEnabled'], function(result) {
          try {
            const currentState = result.retweetHiderEnabled !== false;
            const newState = !currentState;
            
            chrome.storage.sync.set({ retweetHiderEnabled: newState }, function() {
              try {
                isEnabled = newState;
                updateToggleState(newState);
                updateStatus(newState);
                
                if (chrome && chrome.tabs) {
                  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    try {
                      if (tabs[0] && (tabs[0].url.includes('x.com') || tabs[0].url.includes('twitter.com'))) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                          action: 'toggleRetweetHider',
                          enabled: newState
                        });
                      }
                    } catch (error) {
                      console.error('Tab message sending error:', error);
                    }
                  });
                }
              } catch (error) {
                console.error('Toggle update error:', error);
              }
            });
          } catch (error) {
            console.error('Storage read error:', error);
          }
        });
      }
    } catch (error) {
      console.error('Chrome API access error:', error);
    }
  });
  
  function loadStatistics() {
    if (!totalHidden || !todayHidden || !weekHidden || !monthHidden || !topUsersList) {
      console.error('Statistics elements not found');
      return;
    }
    
    try {
      if (chrome && chrome.storage) {
        chrome.storage.local.get(['retweetStats', 'userStats'], function(result) {
          try {
            const stats = result.retweetStats || {
              total: 0,
              today: 0,
              week: 0,
              month: 0
            };
            
            const userStats = result.userStats || {};
            
            try {
              totalHidden.textContent = stats.total || 0;
              todayHidden.textContent = stats.today || 0;
              weekHidden.textContent = stats.week || 0;
              monthHidden.textContent = stats.month || 0;
              
              updateTopUsers(userStats);
            } catch (error) {
              console.error('Error updating statistics display:', error);
            }
          } catch (error) {
            console.error('Storage data read error:', error);
          }
        });
      } else {
        console.error('Chrome storage not available');
      }
    } catch (error) {
      console.error('Chrome storage access error:', error);
    }
  }
  
  function updateTopUsers(userStats) {
    if (!topUsersList) return;
    
    const users = Object.entries(userStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    if (users.length === 0) {
      topUsersList.innerHTML = `
        <div class="user-item placeholder">
          <span class="user-name">No data yet</span>
          <span class="user-count">-</span>
        </div>
      `;
      return;
    }
    
    topUsersList.innerHTML = users.map(([username, count]) => `
      <div class="user-item">
        <a href="https://x.com/${username}" target="_blank" class="user-name">@${username}</a>
        <span class="user-count">${count}</span>
      </div>
    `).join('');
  }
  
  function updateToggleState(enabled) {
    if (!toggleSwitch) return;
    
    if (enabled) {
      toggleSwitch.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
    }
  }
  
  setInterval(loadStatistics, 5000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

window.addEventListener('load', function() {
  if (!document.getElementById('toggleSwitch')) {
    console.error('Toggle switch still not found, retrying...');
    setTimeout(initializePopup, 100);
  }
}); 