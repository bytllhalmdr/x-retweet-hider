let isEnabled = true;
let hiddenTweets = new Set();

try {
  if (chrome && chrome.storage) {
    chrome.storage.sync.get(['retweetHiderEnabled'], function(result) {
      try {
        isEnabled = result.retweetHiderEnabled !== false;
      } catch (error) {
        console.error('Storage read error:', error);
      }
    });
  }
} catch (error) {
  console.error('Chrome storage access error:', error);
}

try {
  if (chrome && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      try {
        if (request.action === 'toggleRetweetHider') {
          isEnabled = request.enabled;
          
          if (isEnabled) {
            hideExistingRetweets();
          } else {
            showHiddenRetweets();
          }
        }
      } catch (error) {
        console.error('Message processing error:', error);
      }
    });
  }
} catch (error) {
  console.error('Chrome runtime access error:', error);
}

function updateStatistics(username) {
  try {
    if (!chrome || !chrome.storage) {
      console.error('Chrome API not accessible');
      return;
    }
    
    const now = new Date();
    const today = now.toDateString();
    
    const weekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(now.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartString = weekStart.toDateString();
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartString = monthStart.toDateString();
    
    chrome.storage.local.get(['retweetStats', 'userStats'], function(result) {
      try {
        const stats = result.retweetStats || {
          total: 0,
          today: 0,
          week: 0,
          month: 0,
          lastUpdate: {}
        };
        
        const userStats = result.userStats || {};
        
        stats.total++;
        
        if (stats.lastUpdate.today === today) {
          stats.today++;
        } else {
          stats.today = 1;
          stats.lastUpdate.today = today;
        }
        
        if (stats.lastUpdate.week === weekStartString) {
          stats.week++;
        } else {
          stats.week = 1;
          stats.lastUpdate.week = weekStartString;
        }
        
        if (stats.lastUpdate.month === monthStartString) {
          stats.month++;
        } else {
          stats.month = 1;
          stats.lastUpdate.month = monthStartString;
        }
        
        if (username) {
          userStats[username] = (userStats[username] || 0) + 1;
        }
        
        chrome.storage.local.set({
          retweetStats: stats,
          userStats: userStats
        });
      } catch (error) {
        console.error('Error updating statistics:', error);
      }
    });
  } catch (error) {
    console.error('Chrome storage access error:', error);
  }
}

function extractUsername(tweet) {

  const retweetLabel = tweet.querySelector('span');
  if (retweetLabel && (retweetLabel.innerText.includes("gönderiyi yeniden yayınladı") || retweetLabel.innerText.includes("reposted") || retweetLabel.innerText.includes("reposteó") || retweetLabel.innerText.includes("ने रीपोस्ट किया") || retweetLabel.innerText.includes("さんがリポスト") || retweetLabel.innerText.includes("memposting ulang"))) {

    const allLinks = tweet.querySelectorAll('a[href^="/"]');
    
    for (let i = 0; i < allLinks.length; i++) {
      const link = allLinks[i];
      const href = link.getAttribute('href');
      
      if (href && !href.includes('/status/') && href.match(/^\/([^\/]+)$/)) {
        const match = href.match(/^\/([^\/]+)$/);
        if (match) {
          return match[1];
        }
      }
    }
    
    let currentElement = retweetLabel;
    while (currentElement && currentElement !== tweet) {
      const allLinks = currentElement.querySelectorAll('a[href^="/"]');
      
      for (let link of allLinks) {
        const href = link.getAttribute('href');
        
        if (href && !href.includes('/status/') && href.match(/^\/([^\/]+)$/)) {
          const match = href.match(/^\/([^\/]+)$/);
          if (match) {
            return match[1];
          }
        }
      }
      
      const prevSibling = currentElement.previousElementSibling;
      if (prevSibling) {
        const usernameLink = prevSibling.querySelector('a[href^="/"]');
        if (usernameLink) {
          const href = usernameLink.getAttribute('href');
          if (href && !href.includes('/status/') && href.match(/^\/([^\/]+)$/)) {
            const match = href.match(/^\/([^\/]+)$/);
            if (match) {
              return match[1];
            }
          }
        }
      }
      
      currentElement = currentElement.parentElement;
    }
    
    const headerLinks = tweet.querySelectorAll('header a[href^="/"]');
    
    for (let link of headerLinks) {
      const href = link.getAttribute('href');
      
      if (href && !href.includes('/status/') && href.match(/^\/([^\/]+)$/)) {
        const match = href.match(/^\/([^\/]+)$/);
        if (match) {
          return match[1];
        }
      }
    }
  }
  
  return null;
}

function hideRetweets(entries, observer) {
  if (!isEnabled) return;
  
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const tweet = entry.target;
      const retweetLabel = tweet.querySelector('span');

      if (retweetLabel && (retweetLabel.innerText.includes("gönderiyi yeniden yayınladı") || retweetLabel.innerText.includes("reposted") || retweetLabel.innerText.includes("reposteó") || retweetLabel.innerText.includes("ने रीपोस्ट किया") || retweetLabel.innerText.includes("さんがリポスト") || retweetLabel.innerText.includes("memposting ulang"))) {
        tweet.style.display = "none";
        hiddenTweets.add(tweet);
        
        const username = extractUsername(tweet);
        updateStatistics(username);
      }
      observer.unobserve(tweet);
    }
  });
}

function hideExistingRetweets() {
  const tweets = document.querySelectorAll("article");
  tweets.forEach(tweet => {
    const retweetLabel = tweet.querySelector('span');
    if (retweetLabel && (retweetLabel.innerText.includes("gönderiyi yeniden yayınladı") || retweetLabel.innerText.includes("reposted") || retweetLabel.innerText.includes("reposteó") || retweetLabel.innerText.includes("ने रीपोस्ट किया") || retweetLabel.innerText.includes("さんがリポスト") || retweetLabel.innerText.includes("memposting ulang"))) {
      tweet.style.display = "none";
      hiddenTweets.add(tweet);
      
      const username = extractUsername(tweet);
      updateStatistics(username);
    }
  });
}

function showHiddenRetweets() {
  hiddenTweets.forEach(tweet => {
    tweet.style.display = "";
  });
  hiddenTweets.clear();
}

const observer = new IntersectionObserver(hideRetweets, {
  root: null,
  rootMargin: '0px',
  threshold: 0.1
});

function observeTweets() {
  const tweets = document.querySelectorAll("article:not([data-observed])");
  tweets.forEach(tweet => {
    tweet.setAttribute('data-observed', 'true');
    observer.observe(tweet);
  });
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const debouncedObserveTweets = debounce(observeTweets, 200);

const mutationObserver = new MutationObserver(debouncedObserveTweets);
mutationObserver.observe(document.body, { childList: true, subtree: true });

try {
  if (isEnabled) {
    hideExistingRetweets();
  }
  
  observeTweets();
} catch (error) {
  console.error('Initialization error:', error);
}

window.addEventListener('beforeunload', function() {
  try {
    if (observer) {
      observer.disconnect();
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});