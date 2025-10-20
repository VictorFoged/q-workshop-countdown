// AWS Countdown Timer Extension - Content Script
// This file contains the main countdown timer functionality with URL pattern detection
// Implements requirements 4.2, 4.4 for content script injection and automatic activation

console.log('AWS Countdown Timer Extension loaded');

// Prevent script from running multiple times on the same page
if (window.awsCountdownTimerLoaded) {
  console.log('AWS Countdown Timer: Script already loaded, preventing duplicate execution');
} else {
  window.awsCountdownTimerLoaded = true;

/**
 * CountdownTimer class handles timer state management and persistence
 * Implements requirements 1.1, 1.2, 1.3 for timer functionality
 */
class CountdownTimer {
  constructor(duration = 10 * 60 * 1000) { // Default 10 minutes in milliseconds
    this.defaultDuration = duration;
    this.storageKey = 'aws-countdown-timer-state';
    this.intervalId = null;
    this.syncInterval = null;
    this.visibilityChangeHandler = null;
    this.callbacks = {
      onTick: null,
      onExpire: null
    };
    
    // Initialize timer state
    this.initializeState();
    
    // Set up visibility change detection for browser sleep/wake handling
    this.setupVisibilityChangeDetection();
  }

  /**
   * Initialize timer state from localStorage or create new state
   * Requirement 1.1: Timer starts automatically on URL pattern match
   * Requirement 1.2: Default to 10 minutes unless configured otherwise
   * Requirement 1.2, 1.3: Implement timer state recovery with validation and edge case handling
   */
  initializeState() {
    const savedState = this.loadStateFromStorage();
    
    if (savedState && this.validateStoredData(savedState)) {
      // Resume from saved state with enhanced recovery logic
      this.recoverFromSavedState(savedState);
    } else {
      // Create new timer state
      this.createNewTimerState();
    }
  }

  /**
   * Recover timer state from saved data with edge case handling
   * Requirement 1.2, 1.3: Handle system clock changes, browser sleep, and data integrity
   */
  recoverFromSavedState(savedState) {
    try {
      console.log('AWS Countdown Timer: Recovering from saved state');
      
      // Copy saved state
      this.state = {
        startTime: savedState.startTime,
        duration: savedState.duration,
        isActive: savedState.isActive,
        isExpired: savedState.isExpired,
        remainingTime: savedState.remainingTime || 0
      };

      // Recalculate remaining time to handle any time gaps
      this.calculateRemainingTime();

      // Handle recovery scenarios
      const now = Date.now();
      const elapsed = now - this.state.startTime;
      
      // If timer was active but should have expired during absence
      if (this.state.isActive && !this.state.isExpired && elapsed >= this.state.duration) {
        console.log('AWS Countdown Timer: Timer expired during absence, updating state');
        this.expire();
      }
      
      // If timer was expired, ensure elements are disabled
      if (this.state.isExpired) {
        console.log('AWS Countdown Timer: Recovered expired timer state');
      }

      // Save updated state after recovery
      this.saveStateToStorage();
      
      console.log(`AWS Countdown Timer: State recovered - Active: ${this.state.isActive}, Expired: ${this.state.isExpired}, Remaining: ${this.state.remainingTime}ms`);
    } catch (error) {
      console.error('AWS Countdown Timer: Error recovering from saved state:', error);
      // Fall back to creating new state
      this.createNewTimerState();
    }
  }

  /**
   * Create new timer state
   * Requirement 1.1, 1.2: Create fresh timer with default settings
   */
  createNewTimerState() {
    console.log('AWS Countdown Timer: Creating new timer state');
    
    this.state = {
      startTime: Date.now(),
      duration: this.defaultDuration,
      isActive: true,
      isExpired: false,
      remainingTime: this.defaultDuration
    };
    
    this.saveStateToStorage();
  }

  /**
   * Load timer state from localStorage
   * Requirement 1.3: Timer persistence for page refreshes
   * Requirement 1.2: Add validation for stored timer data integrity
   */
  loadStateFromStorage() {
    try {
      // Defensive check for localStorage availability
      if (typeof localStorage === 'undefined' || !localStorage.getItem) {
        console.warn('AWS Countdown Timer: localStorage not available');
        return null;
      }

      const savedData = localStorage.getItem(this.storageKey);
      if (!savedData) {
        return null;
      }

      const parsedData = JSON.parse(savedData);
      
      // Enhanced validation for data integrity
      if (!this.validateStoredData(parsedData)) {
        console.warn('AWS Countdown Timer: Stored data failed validation, clearing invalid data');
        this.clearStoredState();
        return null;
      }

      return parsedData;
    } catch (error) {
      console.warn('AWS Countdown Timer: Failed to load timer state from localStorage:', error);
      // Clear potentially corrupted data
      this.clearStoredState();
      return null;
    }
  }

  /**
   * Save current timer state to localStorage
   * Requirement 1.3: Timer persistence for page refreshes
   * Requirement 1.2: Add validation for stored timer data integrity
   */
  saveStateToStorage() {
    try {
      // Defensive check for localStorage availability
      if (typeof localStorage === 'undefined' || !localStorage.setItem) {
        console.warn('AWS Countdown Timer: localStorage not available for saving');
        return;
      }

      // Add timestamp for data integrity validation
      const stateToSave = {
        ...this.state,
        savedAt: Date.now(),
        version: '1.0' // Version for future compatibility
      };

      localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('AWS Countdown Timer: Failed to save timer state to localStorage:', error);
    }
  }

  /**
   * Validate saved state structure and data integrity
   * Requirement 1.2: Add validation for stored timer data integrity
   * Requirement 1.3: Handle edge cases like system clock changes
   */
  isValidSavedState(savedState) {
    return savedState &&
           typeof savedState.startTime === 'number' &&
           typeof savedState.duration === 'number' &&
           typeof savedState.isActive === 'boolean' &&
           typeof savedState.isExpired === 'boolean' &&
           savedState.startTime > 0 &&
           savedState.duration > 0;
  }

  /**
   * Enhanced validation for stored data including edge case detection
   * Requirement 1.2: Add validation for stored timer data integrity
   * Requirement 1.3: Handle edge cases like system clock changes or browser sleep
   */
  validateStoredData(savedState) {
    try {
      // Basic structure validation
      if (!this.isValidSavedState(savedState)) {
        return false;
      }

      const now = Date.now();
      
      // Check for reasonable timestamp ranges (not too far in past or future)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const maxFuture = 5 * 60 * 1000; // 5 minutes in future (clock skew tolerance)
      
      if (savedState.startTime < (now - maxAge)) {
        console.warn('AWS Countdown Timer: Saved state is too old, discarding');
        return false;
      }
      
      if (savedState.startTime > (now + maxFuture)) {
        console.warn('AWS Countdown Timer: Saved state is from future (possible clock change), discarding');
        return false;
      }

      // Check for reasonable duration (between 1 minute and 24 hours)
      const minDuration = 60 * 1000; // 1 minute
      const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
      
      if (savedState.duration < minDuration || savedState.duration > maxDuration) {
        console.warn('AWS Countdown Timer: Invalid duration in saved state, discarding');
        return false;
      }

      // Check for data corruption indicators
      if (savedState.savedAt && typeof savedState.savedAt === 'number') {
        const timeSinceSave = now - savedState.savedAt;
        
        // If saved more than 1 hour ago, validate against potential system sleep
        if (timeSinceSave > 60 * 60 * 1000) {
          console.warn('AWS Countdown Timer: Data saved over 1 hour ago, checking for system sleep');
          
          // Calculate expected remaining time vs actual
          const expectedElapsed = now - savedState.startTime;
          const expectedRemaining = Math.max(0, savedState.duration - expectedElapsed);
          
          // If timer should have expired long ago but wasn't marked as expired, 
          // this indicates system sleep or clock change
          if (expectedRemaining === 0 && !savedState.isExpired) {
            console.warn('AWS Countdown Timer: Timer should have expired during system sleep, marking as expired');
            // We'll handle this in the recovery logic
          }
        }
      }

      return true;
    } catch (error) {
      console.error('AWS Countdown Timer: Error validating stored data:', error);
      return false;
    }
  }

  /**
   * Clear stored state from localStorage
   * Requirement 1.2: Handle corrupted or invalid data
   */
  clearStoredState() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
        localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.warn('AWS Countdown Timer: Error clearing stored state:', error);
    }
  }

  /**
   * Calculate remaining time based on elapsed time since start
   * Requirement 1.3: Accurate time tracking across page refreshes
   * Requirement 1.2, 1.3: Handle edge cases like system clock changes or browser sleep
   */
  calculateRemainingTime() {
    if (this.state.isExpired) {
      this.state.remainingTime = 0;
      return;
    }

    const now = Date.now();
    const elapsed = now - this.state.startTime;
    
    // Handle edge case: negative elapsed time (system clock moved backward)
    if (elapsed < 0) {
      console.warn('AWS Countdown Timer: Negative elapsed time detected (clock moved backward)');
      // Reset start time to current time to handle clock changes
      this.state.startTime = now;
      this.state.remainingTime = this.state.duration;
      this.saveStateToStorage();
      return;
    }

    // Handle edge case: extremely large elapsed time (system sleep or clock jump forward)
    const maxReasonableElapsed = this.state.duration + (60 * 60 * 1000); // Duration + 1 hour buffer
    if (elapsed > maxReasonableElapsed) {
      console.warn('AWS Countdown Timer: Excessive elapsed time detected (possible system sleep or clock jump)');
      // If timer should have expired, mark it as expired
      if (elapsed >= this.state.duration) {
        this.state.remainingTime = 0;
        this.expire();
        return;
      }
    }

    this.state.remainingTime = Math.max(0, this.state.duration - elapsed);
    
    if (this.state.remainingTime === 0) {
      this.expire();
    }
  }

  /**
   * Start the countdown timer
   * Requirement 1.1: Timer starts automatically
   * Requirement 1.3: Updates display every second
   * Requirement 1.2, 1.3: Start synchronization monitoring for edge case handling
   */
  start() {
    if (this.state.isExpired || !this.state.isActive) {
      return;
    }

    // Clear any existing interval
    this.stop();

    // Start new interval for second-by-second updates
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);

    // Start synchronization monitoring for edge case detection
    this.startSynchronizationMonitoring();

    // Immediate tick to update display
    this.tick();
  }

  /**
   * Stop the countdown timer
   * Requirement 1.2, 1.3: Stop synchronization monitoring when timer stops
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Stop synchronization monitoring
    this.stopSynchronizationMonitoring();
  }

  /**
   * Handle timer tick - update remaining time and check for expiration
   * Requirement 1.3: Updates every second
   */
  tick() {
    this.calculateRemainingTime();
    this.saveStateToStorage();

    // Call tick callback if registered
    if (this.callbacks.onTick) {
      this.callbacks.onTick(this.state.remainingTime, this.state);
    }

    // Check for expiration
    if (this.state.remainingTime <= 0) {
      this.expire();
    }
  }

  /**
   * Handle timer expiration
   * Requirement 1.4: Display expired message when countdown reaches zero
   */
  expire() {
    this.state.isExpired = true;
    this.state.isActive = false;
    this.state.remainingTime = 0;
    this.saveStateToStorage();
    this.stop();

    // Call expire callback if registered
    if (this.callbacks.onExpire) {
      this.callbacks.onExpire();
    }
  }

  /**
   * Reset timer to initial state
   * Requirement 1.2, 1.3: Reset with proper cleanup and reinitialization
   */
  reset() {
    this.stop();
    this.createNewTimerState();
  }

  /**
   * Destroy timer and clean up all resources
   * Requirement 1.2, 1.3: Proper cleanup of synchronization and monitoring
   */
  destroy() {
    this.stop();
    this.cleanupVisibilityChangeDetection();
    this.clearStoredState();
  }

  /**
   * Register callback functions for timer events
   */
  onTick(callback) {
    this.callbacks.onTick = callback;
  }

  onExpire(callback) {
    this.callbacks.onExpire = callback;
  }

  /**
   * Get current timer state (read-only)
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if timer is currently active
   */
  isActive() {
    return this.state.isActive && !this.state.isExpired;
  }

  /**
   * Check if timer has expired
   */
  isExpired() {
    return this.state.isExpired;
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingTime() {
    return this.state.remainingTime;
  }

  /**
   * Perform synchronization check to detect and handle edge cases
   * Requirement 1.2, 1.3: Handle system clock changes, browser sleep, and maintain accuracy
   */
  performSynchronizationCheck() {
    try {
      const now = Date.now();
      const expectedElapsed = now - this.state.startTime;
      const currentRemaining = this.state.remainingTime;
      const calculatedRemaining = Math.max(0, this.state.duration - expectedElapsed);
      
      // Check for significant time discrepancies (more than 5 seconds)
      const discrepancy = Math.abs(currentRemaining - calculatedRemaining);
      const maxDiscrepancy = 5000; // 5 seconds
      
      if (discrepancy > maxDiscrepancy) {
        console.warn(`AWS Countdown Timer: Time discrepancy detected: ${discrepancy}ms`);
        
        // Recalculate and update state
        this.calculateRemainingTime();
        this.saveStateToStorage();
        
        return true; // Indicates synchronization was needed
      }
      
      return false; // No synchronization needed
    } catch (error) {
      console.error('AWS Countdown Timer: Error during synchronization check:', error);
      return false;
    }
  }

  /**
   * Start periodic synchronization checks
   * Requirement 1.2, 1.3: Maintain timer accuracy and handle edge cases
   */
  startSynchronizationMonitoring() {
    // Clear any existing sync interval
    this.stopSynchronizationMonitoring();
    
    // Check every 30 seconds for time discrepancies
    this.syncInterval = setInterval(() => {
      if (this.state.isActive && !this.state.isExpired) {
        this.performSynchronizationCheck();
      }
    }, 30000);
  }

  /**
   * Stop periodic synchronization checks
   */
  stopSynchronizationMonitoring() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Set up visibility change detection to handle browser sleep/wake scenarios
   * Requirement 1.2, 1.3: Handle edge cases like browser sleep and system changes
   */
  setupVisibilityChangeDetection() {
    try {
      // Check if Page Visibility API is available
      if (typeof document === 'undefined' || !document.addEventListener) {
        console.warn('AWS Countdown Timer: Page Visibility API not available');
        return;
      }

      this.visibilityChangeHandler = () => {
        try {
          if (!document.hidden) {
            // Page became visible - check for time discrepancies
            console.log('AWS Countdown Timer: Page became visible, performing synchronization check');
            
            if (this.state.isActive && !this.state.isExpired) {
              const syncNeeded = this.performSynchronizationCheck();
              
              if (syncNeeded) {
                console.log('AWS Countdown Timer: Synchronization performed after visibility change');
                
                // Trigger callbacks to update display
                if (this.callbacks.onTick) {
                  this.callbacks.onTick(this.state.remainingTime, this.state);
                }
                
                // Check if timer expired during absence
                if (this.state.isExpired && this.callbacks.onExpire) {
                  this.callbacks.onExpire();
                }
              }
            }
          }
        } catch (error) {
          console.error('AWS Countdown Timer: Error in visibility change handler:', error);
        }
      };

      // Add event listener for visibility changes
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      
      console.log('AWS Countdown Timer: Visibility change detection set up');
    } catch (error) {
      console.error('AWS Countdown Timer: Error setting up visibility change detection:', error);
    }
  }

  /**
   * Clean up visibility change detection
   */
  cleanupVisibilityChangeDetection() {
    try {
      if (this.visibilityChangeHandler && document && document.removeEventListener) {
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
        this.visibilityChangeHandler = null;
      }
    } catch (error) {
      console.warn('AWS Countdown Timer: Error cleaning up visibility change detection:', error);
    }
  }
}

/**
 * TimerDisplay class handles DOM element creation and display updates
 * Implements requirement 1.3 for timer display formatting and updates
 */
class TimerDisplay {
  constructor() {
    this.overlayElement = null;
    this.timerElement = null;
    this.messageElement = null;
    this.isCreated = false;
  }

  /**
   * Create DOM elements for countdown display
   * Requirement 1.3: Create DOM element for countdown display with proper formatting
   * Requirement 4.2: Add null checks and defensive DOM manipulation
   */
  createOverlay() {
    if (this.isCreated) {
      return;
    }

    try {
      // Defensive check for document and body availability
      if (!document || !document.body) {
        console.warn('AWS Countdown Timer: Document or body not available for overlay creation');
        return;
      }

      // Create main overlay container with error handling
      this.overlayElement = document.createElement('div');
      if (!this.overlayElement) {
        throw new Error('Failed to create overlay element');
      }
      
      this.overlayElement.id = 'aws-countdown-overlay';
      this.overlayElement.className = 'aws-countdown-overlay';

      // Create timer display element with null check
      this.timerElement = document.createElement('div');
      if (!this.timerElement) {
        throw new Error('Failed to create timer element');
      }
      this.timerElement.className = 'aws-countdown-timer';
      this.timerElement.textContent = '10:00';

      // Create message element for expired state with null check
      this.messageElement = document.createElement('div');
      if (!this.messageElement) {
        throw new Error('Failed to create message element');
      }
      this.messageElement.className = 'aws-countdown-message';
      this.messageElement.style.display = 'none';

      // Create title element with null check
      const titleElement = document.createElement('div');
      if (!titleElement) {
        throw new Error('Failed to create title element');
      }
      titleElement.className = 'aws-countdown-title';
      titleElement.textContent = 'AWS Task Timer';

      // Assemble overlay structure with defensive appendChild calls
      try {
        this.overlayElement.appendChild(titleElement);
        this.overlayElement.appendChild(this.timerElement);
        this.overlayElement.appendChild(this.messageElement);
      } catch (appendError) {
        console.error('AWS Countdown Timer: Error assembling overlay structure:', appendError);
        return;
      }

      // Inject into page with defensive DOM manipulation
      try {
        document.body.appendChild(this.overlayElement);
        this.isCreated = true;
        console.log('AWS Countdown Timer: Overlay created successfully');
      } catch (injectionError) {
        console.error('AWS Countdown Timer: Error injecting overlay into page:', injectionError);
        // Clean up partially created elements
        this.cleanup();
      }
    } catch (error) {
      console.error('AWS Countdown Timer: Error creating overlay:', error);
      // Ensure cleanup on any error
      this.cleanup();
    }
  }

  /**
   * Clean up partially created DOM elements
   * Requirement 4.2: Add graceful fallbacks for missing elements
   */
  cleanup() {
    try {
      if (this.overlayElement && this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement);
      }
    } catch (error) {
      console.warn('AWS Countdown Timer: Error during cleanup:', error);
    }
    
    this.overlayElement = null;
    this.timerElement = null;
    this.messageElement = null;
    this.isCreated = false;
  }

  /**
   * Update timer display with formatted time
   * Requirement 1.3: Implement time formatting (MM:SS format)
   * Requirement 4.2: Add null checks for element operations
   */
  updateDisplay(remainingTimeMs, isExpired = false) {
    try {
      if (!this.isCreated) {
        this.createOverlay();
      }

      // Defensive check for overlay elements before updating
      if (!this.overlayElement || !this.timerElement || !this.messageElement) {
        console.warn('AWS Countdown Timer: Overlay elements not available for update');
        return;
      }

      if (isExpired) {
        this.showExpiredState();
      } else {
        this.showActiveState(remainingTimeMs);
      }
    } catch (error) {
      console.error('AWS Countdown Timer: Error updating display:', error);
    }
  }

  /**
   * Show active timer state with formatted time
   * Requirement 1.3: MM:SS format display
   * Requirement 4.2: Add null checks for element operations
   */
  showActiveState(remainingTimeMs) {
    try {
      // Defensive null checks for all elements
      if (!this.timerElement || !this.messageElement || !this.overlayElement) {
        console.warn('AWS Countdown Timer: Required elements not available for showActiveState');
        return;
      }

      const formattedTime = this.formatTime(remainingTimeMs);
      this.timerElement.textContent = formattedTime;
      this.timerElement.style.display = 'block';
      this.messageElement.style.display = 'none';

      // Apply urgency styling for final 60 seconds with defensive class manipulation
      // Requirement 2.4: Change color to red for final 60 seconds
      try {
        if (remainingTimeMs <= 60000) { // 60 seconds in milliseconds
          this.overlayElement.classList.add('aws-countdown-urgent');
        } else {
          this.overlayElement.classList.remove('aws-countdown-urgent');
        }
      } catch (classError) {
        console.warn('AWS Countdown Timer: Error updating urgency styling:', classError);
      }
    } catch (error) {
      console.error('AWS Countdown Timer: Error in showActiveState:', error);
    }
  }

  /**
   * Show expired timer state
   * Requirement 1.4: Display time expired message
   * Requirements 3.1-3.5: Add expired state message display
   * Requirement 4.2: Add null checks for element operations
   */
  showExpiredState() {
    try {
      // Defensive null checks for all required elements
      if (!this.timerElement || !this.messageElement || !this.overlayElement) {
        console.warn('AWS Countdown Timer: Required elements not available for showExpiredState');
        return;
      }

      this.timerElement.style.display = 'none';
      this.messageElement.textContent = 'Time Expired - Form Disabled';
      this.messageElement.style.display = 'block';
      
      // Defensive class manipulation
      try {
        this.overlayElement.classList.add('aws-countdown-expired');
      } catch (classError) {
        console.warn('AWS Countdown Timer: Error adding expired class:', classError);
      }
    } catch (error) {
      console.error('AWS Countdown Timer: Error in showExpiredState:', error);
    }
  }

  /**
   * Show waiting state for non-countdown task pages
   * Displays message indicating user should navigate to /task/1 to start countdown
   */
  showWaitingState() {
    try {
      // Defensive null checks for all required elements
      if (!this.timerElement || !this.messageElement || !this.overlayElement) {
        console.warn('AWS Countdown Timer: Required elements not available for showWaitingState');
        return;
      }

      this.timerElement.style.display = 'none';
      this.messageElement.textContent = 'Navigate to /task/1 to start countdown';
      this.messageElement.style.display = 'block';
      
      // Remove any existing state classes
      try {
        this.overlayElement.classList.remove('aws-countdown-expired', 'aws-countdown-urgent');
        this.overlayElement.classList.add('aws-countdown-waiting');
      } catch (classError) {
        console.warn('AWS Countdown Timer: Error updating waiting state classes:', classError);
      }
    } catch (error) {
      console.error('AWS Countdown Timer: Error in showWaitingState:', error);
    }
  }

  /**
   * Format milliseconds to MM:SS format
   * Requirement 1.3: Time formatting (MM:SS format)
   */
  formatTime(milliseconds) {
    // Ensure non-negative value
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    // Format with leading zeros
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    
    return `${formattedMinutes}:${formattedSeconds}`;
  }

  /**
   * Remove overlay from DOM
   * Requirement 4.2: Add defensive DOM manipulation with error handling
   */
  destroy() {
    try {
      if (this.overlayElement && this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement);
      }
    } catch (error) {
      console.warn('AWS Countdown Timer: Error removing overlay from DOM:', error);
    }
    
    // Always clean up references regardless of removal success
    this.isCreated = false;
    this.overlayElement = null;
    this.timerElement = null;
    this.messageElement = null;
  }

  /**
   * Check if overlay is currently visible
   */
  isVisible() {
    return this.isCreated && this.overlayElement && this.overlayElement.parentNode;
  }
}

/**
 * Main timer controller that coordinates CountdownTimer, TimerDisplay, and ElementDisabler
 * Implements setInterval logic for second-by-second updates and element disabling integration
 */
class TimerController {
  constructor() {
    this.timer = new CountdownTimer();
    this.display = new TimerDisplay();
    this.elementDisabler = new ElementDisabler();
    this.isInitialized = false;
    this.refreshInterval = null;
  }

  /**
   * Initialize timer controller and set up event handlers
   * Requirement 1.3: Add setInterval logic for second-by-second updates
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Set up timer callbacks
    this.timer.onTick((remainingTime, state) => {
      this.display.updateDisplay(remainingTime, state.isExpired);
    });

    this.timer.onExpire(() => {
      this.handleTimerExpiration();
    });

    // Create initial display
    this.display.createOverlay();
    
    // Update display with current state
    const currentState = this.timer.getState();
    this.display.updateDisplay(currentState.remainingTime, currentState.isExpired);

    // Handle expired state on initialization
    if (currentState.isExpired) {
      this.handleTimerExpiration();
    } else if (this.timer.isActive()) {
      // Start timer if active
      this.timer.start();
      // Start periodic refresh for element disabling
      this.startElementRefresh();
    }

    this.isInitialized = true;
    console.log('AWS Countdown Timer: Timer controller initialized');
  }

  /**
   * Get timer controller instance
   */
  getTimer() {
    return this.timer;
  }

  /**
   * Get display instance
   */
  getDisplay() {
    return this.display;
  }

  /**
   * Reset timer and display
   */
  reset() {
    // Stop monitoring and restore elements
    this.stopExpiredStateMonitoring();
    this.elementDisabler.restoreElements();
    
    // Reset timer
    this.timer.reset();
    this.display.updateDisplay(this.timer.getRemainingTime(), false);
    this.timer.start();
    
    // Restart element refresh
    this.startElementRefresh();
  }

  /**
   * Handle timer expiration event
   * Requirements 1.4, 3.1, 3.2, 3.3, 3.4, 3.5: Connect timer expiration to element disabling
   */
  handleTimerExpiration() {
    // Update display to show expired state
    this.display.updateDisplay(0, true);
    
    // Disable all target form elements
    this.elementDisabler.disableAllTargetElements();
    
    // Stop element refresh since timer is expired
    this.stopElementRefresh();
    
    // Start monitoring for new elements that need to be disabled
    this.startExpiredStateMonitoring();
    
    console.log('AWS Countdown Timer: Timer expired - form elements disabled');
  }

  /**
   * Start periodic refresh to ensure disabled elements remain disabled
   * Requirement: Ensure disabled elements remain disabled after page interactions
   */
  startElementRefresh() {
    // Clear any existing refresh interval
    this.stopElementRefresh();
    
    // Refresh every 2 seconds to catch new elements
    this.refreshInterval = setInterval(() => {
      if (this.timer.isExpired()) {
        this.elementDisabler.refreshDisabledElements();
      }
    }, 2000);
  }

  /**
   * Stop element refresh interval
   */
  stopElementRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Start monitoring for new elements in expired state
   * Ensures disabled elements remain disabled after page interactions
   */
  startExpiredStateMonitoring() {
    // Use MutationObserver to watch for DOM changes
    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        
        mutations.forEach((mutation) => {
          // Check if new nodes were added
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              // Check if added node contains form elements
              if (node.nodeType === Node.ELEMENT_NODE) {
                const hasFormElements = node.matches && (
                  node.matches('input, textarea, button') ||
                  node.querySelector('input, textarea, button')
                );
                if (hasFormElements) {
                  shouldRefresh = true;
                }
              }
            });
          }
        });
        
        // Refresh disabled elements if new form elements were detected
        if (shouldRefresh) {
          setTimeout(() => {
            this.elementDisabler.refreshDisabledElements();
          }, 100); // Small delay to ensure DOM is fully updated
        }
      });
      
      // Start observing
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      // Fallback to periodic refresh if MutationObserver is not available
      this.startElementRefresh();
    }
  }

  /**
   * Stop expired state monitoring
   */
  stopExpiredStateMonitoring() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.stopElementRefresh();
  }

  /**
   * Get element disabler instance
   */
  getElementDisabler() {
    return this.elementDisabler;
  }

  /**
   * Check if elements are currently disabled
   */
  areElementsDisabled() {
    return this.elementDisabler.areElementsDisabled();
  }

  /**
   * Get count of disabled elements
   */
  getDisabledElementCount() {
    return this.elementDisabler.getDisabledElementCount();
  }

  /**
   * Destroy timer controller and clean up
   */
  destroy() {
    this.timer.stop();
    this.display.destroy();
    this.stopExpiredStateMonitoring();
    this.elementDisabler.restoreElements();
    this.isInitialized = false;
  }
}

/**
 * ElementDisabler class handles form element disabling functionality
 * Implements requirements 3.1, 3.2, 3.3, 3.4, 3.5 for element manipulation
 */
class ElementDisabler {
  constructor() {
    this.disabledElements = new Set();
    this.originalStyles = new Map();
    this.isDisabled = false;
    
    // Element selectors configuration
    this.selectors = {
      textInputs: [
        'input[type="text"]',
        'input[type="email"]', 
        'input[type="password"]',
        'input[type="search"]',
        'input[type="url"]',
        'input[type="tel"]',
        'input[type="number"]',
        'textarea'
      ],
      targetButtonTexts: [
        'Submit Code',
        'Next Task'
      ]
    };
  }

  /**
   * Find and select all text inputs and textareas on the page
   * Requirement 3.1: Disable all text input fields
   * Requirement 3.2: Disable all textarea elements
   * Requirement 4.2: Add null checks for element selection operations
   */
  findTextInputElements() {
    const elements = [];
    
    try {
      // Defensive check for document availability
      if (!document || !document.querySelectorAll) {
        console.warn('AWS Countdown Timer: Document or querySelectorAll not available');
        return elements;
      }

      this.selectors.textInputs.forEach(selector => {
        try {
          const foundElements = document.querySelectorAll(selector);
          if (foundElements && foundElements.length > 0) {
            foundElements.forEach(element => {
              // Defensive null check and disabled state check
              if (element && typeof element.disabled !== 'undefined' && !element.disabled) {
                elements.push(element);
              }
            });
          }
        } catch (selectorError) {
          console.warn(`AWS Countdown Timer: Error with selector "${selector}":`, selectorError);
        }
      });
    } catch (error) {
      console.error('AWS Countdown Timer: Error finding text input elements:', error);
    }
    
    return elements;
  }

  /**
   * Find buttons with specific text content
   * Requirement 3.3: Disable buttons containing "Submit Code"
   * Requirement 3.4: Disable buttons containing "Next Task"
   * Requirement 4.2: Add null checks for element selection operations
   */
  findTargetButtons() {
    const buttons = [];
    
    try {
      // Defensive check for document availability
      if (!document || !document.querySelectorAll) {
        console.warn('AWS Countdown Timer: Document or querySelectorAll not available for button search');
        return buttons;
      }

      const allButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
      
      if (!allButtons || allButtons.length === 0) {
        return buttons;
      }

      allButtons.forEach(button => {
        try {
          // Defensive null check and disabled state check
          if (button && typeof button.disabled !== 'undefined' && !button.disabled) {
            const buttonText = this.getButtonText(button);
            
            // Check if button text matches any target text with defensive string operations
            if (buttonText && typeof buttonText === 'string') {
              const isTargetButton = this.selectors.targetButtonTexts.some(targetText => {
                try {
                  return buttonText.toLowerCase().includes(targetText.toLowerCase());
                } catch (textError) {
                  console.warn('AWS Countdown Timer: Error comparing button text:', textError);
                  return false;
                }
              });
              
              if (isTargetButton) {
                buttons.push(button);
              }
            }
          }
        } catch (buttonError) {
          console.warn('AWS Countdown Timer: Error processing button:', buttonError);
        }
      });
    } catch (error) {
      console.error('AWS Countdown Timer: Error finding target buttons:', error);
    }
    
    return buttons;
  }

  /**
   * Extract text content from button element
   * Handles various button types and text sources
   * Requirement 4.2: Add null checks for element operations
   */
  getButtonText(button) {
    try {
      // Defensive null check for button element
      if (!button) {
        return '';
      }

      // Check value attribute for input buttons with defensive access
      try {
        if (button.tagName && button.tagName.toLowerCase() === 'input' && button.value) {
          return button.value.trim();
        }
      } catch (valueError) {
        console.warn('AWS Countdown Timer: Error accessing button value:', valueError);
      }
      
      // Check textContent for regular buttons with defensive access
      try {
        if (button.textContent) {
          return button.textContent.trim();
        }
      } catch (textContentError) {
        console.warn('AWS Countdown Timer: Error accessing button textContent:', textContentError);
      }
      
      // Check innerText as fallback with defensive access
      try {
        if (button.innerText) {
          return button.innerText.trim();
        }
      } catch (innerTextError) {
        console.warn('AWS Countdown Timer: Error accessing button innerText:', innerTextError);
      }
      
      // Check aria-label for accessibility with defensive access
      try {
        const ariaLabel = button.getAttribute('aria-label');
        if (ariaLabel) {
          return ariaLabel.trim();
        }
      } catch (ariaError) {
        console.warn('AWS Countdown Timer: Error accessing button aria-label:', ariaError);
      }
      
      return '';
    } catch (error) {
      console.error('AWS Countdown Timer: Error extracting button text:', error);
      return '';
    }
  }

  /**
   * Apply visual styling to disabled elements
   * Requirement 3.5: Apply visual styling to indicate elements are no longer interactive
   * Requirement 4.2: Add defensive DOM manipulation with error handling
   */
  applyDisabledStyling(element) {
    try {
      // Defensive null check for element
      if (!element || !element.style) {
        console.warn('AWS Countdown Timer: Invalid element for styling');
        return;
      }

      // Store original styles for potential restoration with defensive access
      const originalStyle = {};
      try {
        originalStyle.opacity = element.style.opacity || '';
        originalStyle.cursor = element.style.cursor || '';
        originalStyle.backgroundColor = element.style.backgroundColor || '';
        originalStyle.color = element.style.color || '';
        originalStyle.pointerEvents = element.style.pointerEvents || '';
      } catch (styleAccessError) {
        console.warn('AWS Countdown Timer: Error accessing original styles:', styleAccessError);
      }
      
      this.originalStyles.set(element, originalStyle);
      
      // Apply disabled styling with defensive style manipulation
      try {
        element.style.opacity = '0.5';
        element.style.cursor = 'not-allowed';
        element.style.backgroundColor = '#f5f5f5';
        element.style.color = '#999999';
        element.style.pointerEvents = 'none';
      } catch (styleError) {
        console.warn('AWS Countdown Timer: Error applying disabled styles:', styleError);
      }
      
      // Add disabled class for CSS styling with defensive class manipulation
      try {
        if (element.classList && element.classList.add) {
          element.classList.add('aws-countdown-disabled');
        }
      } catch (classError) {
        console.warn('AWS Countdown Timer: Error adding disabled class:', classError);
      }
    } catch (error) {
      console.error('AWS Countdown Timer: Error in applyDisabledStyling:', error);
    }
  }

  /**
   * Disable a single element with visual styling
   * Requirement 4.2: Add defensive DOM manipulation with error handling
   */
  disableElement(element) {
    try {
      // Defensive null check and duplicate check
      if (!element || this.disabledElements.has(element)) {
        return;
      }
      
      // Disable the element with defensive property access
      try {
        if (typeof element.disabled !== 'undefined') {
          element.disabled = true;
        }
      } catch (disableError) {
        console.warn('AWS Countdown Timer: Error setting disabled property:', disableError);
      }
      
      // Apply visual styling
      this.applyDisabledStyling(element);
      
      // Track disabled element
      this.disabledElements.add(element);
      
      // Add event listeners to prevent interaction
      this.preventElementInteraction(element);
    } catch (error) {
      console.error('AWS Countdown Timer: Error disabling element:', error);
    }
  }

  /**
   * Add event listeners to prevent interaction with disabled elements
   * Requirement 4.2: Add defensive DOM manipulation with error handling
   */
  preventElementInteraction(element) {
    try {
      // Defensive null check for element and addEventListener method
      if (!element || !element.addEventListener) {
        console.warn('AWS Countdown Timer: Element does not support event listeners');
        return;
      }

      const preventEvent = (event) => {
        try {
          if (event && event.preventDefault && event.stopPropagation) {
            event.preventDefault();
            event.stopPropagation();
          }
          return false;
        } catch (eventError) {
          console.warn('AWS Countdown Timer: Error preventing event:', eventError);
          return false;
        }
      };
      
      // Prevent common interaction events with defensive event listener addition
      const events = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'focus'];
      events.forEach(eventType => {
        try {
          element.addEventListener(eventType, preventEvent, true);
        } catch (listenerError) {
          console.warn(`AWS Countdown Timer: Error adding ${eventType} listener:`, listenerError);
        }
      });
    } catch (error) {
      console.error('AWS Countdown Timer: Error in preventElementInteraction:', error);
    }
  }

  /**
   * Disable all target form elements on the page
   * Requirements 3.1, 3.2, 3.3, 3.4: Disable specified element types
   */
  disableAllTargetElements() {
    if (this.isDisabled) {
      return; // Already disabled
    }
    
    // Find and disable text inputs and textareas
    const textInputs = this.findTextInputElements();
    textInputs.forEach(element => this.disableElement(element));
    
    // Find and disable target buttons
    const targetButtons = this.findTargetButtons();
    targetButtons.forEach(element => this.disableElement(element));
    
    this.isDisabled = true;
    
    console.log(`AWS Countdown Timer: Disabled ${this.disabledElements.size} form elements`);
  }

  /**
   * Re-scan page for new elements and disable them if already in disabled state
   * Ensures disabled elements remain disabled after page interactions
   */
  refreshDisabledElements() {
    if (!this.isDisabled) {
      return;
    }
    
    // Re-scan and disable any new elements that may have appeared
    this.disableAllTargetElements();
  }

  /**
   * Restore original styling and enable elements (for testing/reset purposes)
   * Requirement 4.2: Add defensive DOM manipulation with error handling
   */
  restoreElements() {
    try {
      this.disabledElements.forEach(element => {
        try {
          // Defensive null check for element
          if (!element) {
            return;
          }

          // Re-enable element with defensive property access
          try {
            if (typeof element.disabled !== 'undefined') {
              element.disabled = false;
            }
          } catch (enableError) {
            console.warn('AWS Countdown Timer: Error re-enabling element:', enableError);
          }
          
          // Restore original styles with defensive access
          try {
            const originalStyle = this.originalStyles.get(element);
            if (originalStyle && element.style) {
              Object.keys(originalStyle).forEach(property => {
                try {
                  element.style[property] = originalStyle[property];
                } catch (styleRestoreError) {
                  console.warn(`AWS Countdown Timer: Error restoring style ${property}:`, styleRestoreError);
                }
              });
            }
          } catch (styleError) {
            console.warn('AWS Countdown Timer: Error restoring styles:', styleError);
          }
          
          // Remove disabled class with defensive class manipulation
          try {
            if (element.classList && element.classList.remove) {
              element.classList.remove('aws-countdown-disabled');
            }
          } catch (classError) {
            console.warn('AWS Countdown Timer: Error removing disabled class:', classError);
          }
        } catch (elementError) {
          console.warn('AWS Countdown Timer: Error restoring individual element:', elementError);
        }
      });
      
      // Clear tracking
      this.disabledElements.clear();
      this.originalStyles.clear();
      this.isDisabled = false;
    } catch (error) {
      console.error('AWS Countdown Timer: Error in restoreElements:', error);
    }
  }

  /**
   * Get count of currently disabled elements
   */
  getDisabledElementCount() {
    return this.disabledElements.size;
  }

  /**
   * Check if elements are currently disabled
   */
  areElementsDisabled() {
    return this.isDisabled;
  }

  /**
   * Get list of disabled elements (for debugging)
   */
  getDisabledElements() {
    return Array.from(this.disabledElements);
  }
}

/**
 * URLPatternDetector class handles URL monitoring and pattern matching
 * Implements requirements 1.1, 4.4 for URL pattern detection and auto-activation
 */
class URLPatternDetector {
  constructor() {
    this.taskPatterns = [
      /\/task\/\d+(?:\/|$|\?)/i  // Matches any /task/number path
    ];
    this.countdownPatterns = [
      /\/task\/1(?:\/|$|\?)/i  // Matches /task/1, /task/1/, /task/1?params, /task/1/anything
    ];
    this.currentUrl = window.location.href;
    this.previousUrl = null;
    this.isMonitoring = false;
    this.callbacks = {
      onTaskMatch: null,
      onCountdownMatch: null,
      onNoMatch: null
    };
  }

  /**
   * Check if current URL matches task patterns
   * Returns object with task match and countdown match status
   */
  checkCurrentUrl() {
    const currentPath = window.location.pathname + window.location.search;
    const taskMatch = this.taskPatterns.some(pattern => pattern.test(currentPath));
    const countdownMatch = this.countdownPatterns.some(pattern => pattern.test(currentPath));
    
    console.log(`AWS Countdown Timer: URL check - Path: ${currentPath}, Task Match: ${taskMatch}, Countdown Match: ${countdownMatch}`);
    return { taskMatch, countdownMatch };
  }

  /**
   * Check if current URL should show the extension (any task URL)
   */
  shouldShowExtension() {
    const { taskMatch } = this.checkCurrentUrl();
    return taskMatch;
  }

  /**
   * Check if current URL should start countdown (task/1 only)
   */
  shouldStartCountdown() {
    const { countdownMatch } = this.checkCurrentUrl();
    return countdownMatch;
  }

  /**
   * Check if we should reset the timer based on navigation pattern
   * Returns true if navigating to /task/1 from a non-task page
   */
  shouldResetTimer() {
    if (!this.previousUrl) {
      return false; // No previous URL, don't reset
    }

    const currentStatus = this.checkCurrentUrl();
    const previousPath = this.getPreviousPath();
    const previousTaskMatch = this.taskPatterns.some(pattern => pattern.test(previousPath));

    // Reset timer if:
    // 1. Current URL is /task/1 (countdown match)
    // 2. Previous URL was NOT a task page
    const shouldReset = currentStatus.countdownMatch && !previousTaskMatch;
    
    if (shouldReset) {
      console.log(`AWS Countdown Timer: Should reset timer - navigated to /task/1 from non-task page: ${previousPath}`);
    }
    
    return shouldReset;
  }

  /**
   * Get the path from the previous URL
   */
  getPreviousPath() {
    if (!this.previousUrl) {
      return '';
    }
    
    try {
      const url = new URL(this.previousUrl);
      return url.pathname + url.search;
    } catch (error) {
      console.warn('AWS Countdown Timer: Error parsing previous URL:', error);
      return '';
    }
  }

  /**
   * Start monitoring URL changes for single-page applications
   * Requirement: Add logic to handle URL changes within single-page applications
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    // Monitor for URL changes in single-page applications
    this.setupUrlChangeDetection();
    
    // Check initial URL
    this.handleUrlChange();
    
    this.isMonitoring = true;
    console.log('AWS Countdown Timer: URL monitoring started');
  }

  /**
   * Set up URL change detection for single-page applications
   * Handles both pushState/replaceState and hashchange events
   */
  setupUrlChangeDetection() {
    // Store original pushState and replaceState methods
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    // Override pushState to detect URL changes
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.handleUrlChange(), 0);
    };
    
    // Override replaceState to detect URL changes
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleUrlChange(), 0);
    };
    
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handleUrlChange(), 0);
    });
    
    // Listen for hashchange events
    window.addEventListener('hashchange', () => {
      setTimeout(() => this.handleUrlChange(), 0);
    });
    
    // Periodically check URL as fallback for complex SPAs
    this.urlCheckInterval = setInterval(() => {
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        this.currentUrl = newUrl;
        this.handleUrlChange();
      }
    }, 1000);
  }

  /**
   * Handle URL change event and check for pattern matches
   */
  handleUrlChange() {
    const newUrl = window.location.href;
    const urlChanged = newUrl !== this.currentUrl;
    
    if (urlChanged) {
      console.log(`AWS Countdown Timer: URL changed from ${this.currentUrl} to ${newUrl}`);
      
      // Store previous URL before updating current
      this.previousUrl = this.currentUrl;
      this.currentUrl = newUrl;
    }
    
    const { taskMatch, countdownMatch } = this.checkCurrentUrl();
    
    if (taskMatch) {
      if (this.callbacks.onTaskMatch) {
        // Pass additional info about whether timer should reset
        const shouldReset = this.shouldResetTimer();
        this.callbacks.onTaskMatch(countdownMatch, shouldReset);
      }
    } else {
      if (this.callbacks.onNoMatch) {
        this.callbacks.onNoMatch();
      }
    }
    
    // Separate callback for countdown-specific matches
    if (countdownMatch && this.callbacks.onCountdownMatch) {
      const shouldReset = this.shouldResetTimer();
      this.callbacks.onCountdownMatch(shouldReset);
    }
  }

  /**
   * Stop URL monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    // Clear interval
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('AWS Countdown Timer: URL monitoring stopped');
  }

  /**
   * Register callback for when URL matches task pattern (any /task/*)
   */
  onTaskMatch(callback) {
    this.callbacks.onTaskMatch = callback;
  }

  /**
   * Register callback for when URL matches countdown pattern (/task/1)
   */
  onCountdownMatch(callback) {
    this.callbacks.onCountdownMatch = callback;
  }

  /**
   * Register callback for when URL doesn't match any pattern
   */
  onNoMatch(callback) {
    this.callbacks.onNoMatch = callback;
  }

  /**
   * Add custom URL pattern
   */
  addPattern(pattern) {
    if (pattern instanceof RegExp) {
      this.patterns.push(pattern);
    } else if (typeof pattern === 'string') {
      this.patterns.push(new RegExp(pattern, 'i'));
    }
  }

  /**
   * Get current monitoring status
   */
  isActive() {
    return this.isMonitoring;
  }

  /**
   * Get current URL
   */
  getCurrentUrl() {
    return this.currentUrl;
  }
}

/**
 * Enhanced TimerController with URL pattern detection integration
 * Extends the existing TimerController to include automatic activation
 */
class EnhancedTimerController extends TimerController {
  constructor() {
    super();
    this.urlDetector = new URLPatternDetector();
    this.isAutoActivated = false;
  }

  /**
   * Initialize enhanced timer controller with URL monitoring
   * Requirement 1.1: Timer starts automatically on URL pattern match
   * Requirement 4.4: Automatic timer activation on pattern match
   */
  initialize() {
    // Set up URL pattern detection callbacks
    this.urlDetector.onTaskMatch((shouldStartCountdown, shouldReset) => {
      this.handleTaskMatch(shouldStartCountdown, shouldReset);
    });

    this.urlDetector.onCountdownMatch((shouldReset) => {
      this.handleCountdownMatch(shouldReset);
    });

    this.urlDetector.onNoMatch(() => {
      this.handleUrlNoMatch();
    });

    // Start URL monitoring
    this.urlDetector.startMonitoring();

    // Check current URL and initialize accordingly
    const urlStatus = this.urlDetector.checkCurrentUrl();
    if (urlStatus.taskMatch) {
      // Always show the extension on task pages
      this.createDisplay();
      
      // Check if we have an existing timer from localStorage
      const savedState = this.timer.loadStateFromStorage();
      const hasExistingTimer = savedState && this.timer.validateStoredData(savedState);
      
      if (urlStatus.countdownMatch) {
        // This is /task/1
        // Check if we should reset timer on initial load
        const shouldResetOnLoad = this.shouldResetOnInitialLoad();
        
        if (shouldResetOnLoad) {
          console.log('AWS Countdown Timer: Resetting timer on initial load');
          // Clear any existing timer state and start fresh
          this.clearExistingTimerState();
        }
        
        // Start countdown on /task/1
        super.initialize();
        this.isAutoActivated = true;
        console.log('AWS Countdown Timer: Auto-activated countdown on /task/1');
      } else if (hasExistingTimer) {
        // This is /task/2, /task/3, etc. and we have an existing timer - continue it
        console.log('AWS Countdown Timer: Continuing existing timer on task page');
        this.handleContinueCountdown();
      } else {
        // No existing timer and not on /task/1 - show waiting state
        this.showWaitingState();
        console.log('AWS Countdown Timer: Showing waiting state on task page (not /task/1)');
      }
    } else {
      console.log('AWS Countdown Timer: URL does not match task pattern, extension not shown');
    }
  }

  /**
   * Determine if timer should reset on initial load
   * This handles direct navigation to /task/1 or page refresh scenarios
   */
  shouldResetOnInitialLoad() {
    // For now, we'll be conservative and not reset on initial load
    // This preserves existing behavior where timer persists across page refreshes
    // The reset only happens on navigation between pages
    return false;
  }

  /**
   * Clear existing timer state for fresh start
   */
  clearExistingTimerState() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
        localStorage.removeItem('aws-countdown-timer-state');
        console.log('AWS Countdown Timer: Cleared existing timer state');
      }
    } catch (error) {
      console.warn('AWS Countdown Timer: Error clearing timer state:', error);
    }
  }

  /**
   * Handle task URL match - show extension
   */
  handleTaskMatch(shouldStartCountdown, shouldReset) {
    // Always show the display on task pages
    if (!this.display.isVisible()) {
      this.createDisplay();
    }

    // Check if timer has already been started (from localStorage)
    const currentState = this.timer.getState();
    const hasExistingTimer = currentState.startTime && (currentState.isActive || currentState.isExpired);

    if (shouldStartCountdown) {
      // This is /task/1 - start countdown
      this.handleCountdownMatch(shouldReset);
    } else if (hasExistingTimer) {
      // This is /task/2, /task/3, etc. and we have an existing timer - continue it
      this.handleContinueCountdown();
    } else {
      // No existing timer and not on /task/1 - show waiting state
      this.showWaitingState();
    }
  }

  /**
   * Handle countdown URL match - activate timer
   * Requirement 1.1: Automatic timer activation on pattern match
   */
  handleCountdownMatch(shouldReset = false) {
    // Reset timer if navigating from non-task page
    if (shouldReset) {
      console.log('AWS Countdown Timer: Resetting timer - navigated to /task/1 from non-task page');
      // Clear existing timer state first
      this.clearExistingTimerState();
      
      // If already initialized, reset the timer
      if (this.isInitialized) {
        this.resetTimer();
        return;
      }
      // If not initialized, we'll initialize fresh below
    }

    if (!this.isInitialized && !this.isAutoActivated) {
      console.log('AWS Countdown Timer: Countdown URL matched, activating timer');
      super.initialize();
      this.isAutoActivated = true;
    } else if (this.isInitialized && !this.timer.isActive() && !this.timer.isExpired()) {
      // Restart timer if it was stopped but not expired
      console.log('AWS Countdown Timer: Countdown URL matched, restarting timer');
      this.timer.start();
    }
  }

  /**
   * Handle continuing countdown on subsequent task pages
   * Ensures timer continues running on /task/2, /task/3, etc.
   */
  handleContinueCountdown() {
    if (!this.isInitialized && !this.isAutoActivated) {
      console.log('AWS Countdown Timer: Continuing existing timer on task page');
      super.initialize();
      this.isAutoActivated = true;
    } else if (this.isInitialized && !this.timer.isActive() && !this.timer.isExpired()) {
      // Restart timer if it was stopped but not expired
      console.log('AWS Countdown Timer: Restarting existing timer on task page');
      this.timer.start();
    }
    
    // Update display to show current timer state
    const currentState = this.timer.getState();
    this.display.updateDisplay(currentState.remainingTime, currentState.isExpired);
    
    // If timer is expired, ensure elements are disabled
    if (currentState.isExpired) {
      this.handleTimerExpiration();
    }
  }

  /**
   * Reset timer to fresh state
   */
  resetTimer() {
    if (this.isInitialized) {
      // Stop current timer and reset to fresh state
      this.timer.reset();
      
      // Update display to show fresh timer
      const currentState = this.timer.getState();
      this.display.updateDisplay(currentState.remainingTime, currentState.isExpired);
      
      // Restart timer
      this.timer.start();
      
      console.log('AWS Countdown Timer: Timer reset to fresh 10-minute countdown');
    }
  }

  /**
   * Create display without initializing timer
   */
  createDisplay() {
    if (!this.display.isVisible()) {
      this.display.createOverlay();
    }
  }

  /**
   * Show waiting state for non-countdown task pages
   */
  showWaitingState() {
    if (!this.display.isVisible()) {
      this.createDisplay();
    }
    this.display.showWaitingState();
    console.log('AWS Countdown Timer: Showing waiting state - navigate to /task/1 to start countdown');
  }

  /**
   * Handle URL pattern no match - clear timer when leaving task pages
   */
  handleUrlNoMatch() {
    console.log('AWS Countdown Timer: URL pattern no longer matches - clearing timer state');
    
    // Clear timer state when navigating to non-task pages
    this.clearExistingTimerState();
    
    // Stop and destroy current timer if it exists
    if (this.isInitialized) {
      this.timer.destroy();
      this.display.destroy();
      this.elementDisabler.restoreAllElements();
      this.isInitialized = false;
      this.isAutoActivated = false;
    }
    
    console.log('AWS Countdown Timer: Timer cleared - will reset when returning to /task/1');
  }

  /**
   * Get URL detector instance
   */
  getUrlDetector() {
    return this.urlDetector;
  }

  /**
   * Check if timer was auto-activated
   */
  getAutoActivationStatus() {
    return this.isAutoActivated;
  }

  /**
   * Destroy enhanced timer controller
   */
  destroy() {
    this.urlDetector.stopMonitoring();
    super.destroy();
    this.isAutoActivated = false;
  }
}

/**
 * Content Script Initialization Manager
 * Handles proper initialization timing and ensures timer starts immediately
 * Implements requirements 4.2, 4.4 for content script injection and URL detection
 */
class ContentScriptInitializer {
  constructor() {
    this.timerController = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 5;
  }

  /**
   * Initialize content script with proper timing
   * Requirement 4.2: Add initialization logic that runs on script injection
   * Requirement 4.4: Ensure timer starts immediately when URL pattern is detected
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('AWS Countdown Timer: Content script initializing...');

    // Check if DOM is ready
    if (document.readyState === 'loading') {
      // DOM is still loading, wait for it
      document.addEventListener('DOMContentLoaded', () => {
        this.performInitialization();
      });
    } else {
      // DOM is already loaded, initialize immediately
      this.performInitialization();
    }
  }

  /**
   * Perform the actual initialization
   */
  performInitialization() {
    try {
      // Verify we have a valid document and body
      if (!document || !document.body) {
        this.retryInitialization();
        return;
      }

      // Create and initialize enhanced timer controller
      this.timerController = new EnhancedTimerController();
      
      // Initialize with URL pattern detection
      this.timerController.initialize();
      
      this.isInitialized = true;
      
      console.log('AWS Countdown Timer: Content script successfully initialized');
      
      // Log initialization details
      const urlDetector = this.timerController.getUrlDetector();
      console.log(`AWS Countdown Timer: Current URL: ${urlDetector.getCurrentUrl()}`);
      console.log(`AWS Countdown Timer: URL matches pattern: ${urlDetector.checkCurrentUrl()}`);
      console.log(`AWS Countdown Timer: Auto-activated: ${this.timerController.getAutoActivationStatus()}`);
      
    } catch (error) {
      console.error('AWS Countdown Timer: Initialization failed:', error);
      this.retryInitialization();
    }
  }

  /**
   * Retry initialization with exponential backoff
   */
  retryInitialization() {
    this.initializationAttempts++;
    
    if (this.initializationAttempts >= this.maxInitializationAttempts) {
      console.error('AWS Countdown Timer: Max initialization attempts reached, giving up');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.initializationAttempts - 1), 5000);
    console.log(`AWS Countdown Timer: Retrying initialization in ${delay}ms (attempt ${this.initializationAttempts})`);
    
    setTimeout(() => {
      this.performInitialization();
    }, delay);
  }

  /**
   * Get timer controller instance
   */
  getTimerController() {
    return this.timerController;
  }

  /**
   * Check if initialization was successful
   */
  isReady() {
    return this.isInitialized && this.timerController !== null;
  }
}

/**
 * Global initialization function
 * Requirement 4.2: Initialization logic that runs on script injection
 * Requirement 4.4: Timer starts immediately when URL pattern is detected
 */
function initializeAWSCountdownTimer() {
  // Prevent multiple initializations
  if (window.awsCountdownInitializer) {
    console.log('AWS Countdown Timer: Already initialized, skipping');
    return window.awsCountdownInitializer;
  }

  console.log('AWS Countdown Timer: Starting content script initialization');
  
  // Create and store initializer globally
  window.awsCountdownInitializer = new ContentScriptInitializer();
  
  // Start initialization process
  window.awsCountdownInitializer.initialize();
  
  return window.awsCountdownInitializer;
}

// Initialize immediately when script loads
// Requirement 4.2: Add initialization logic that runs on script injection
// Requirement 4.4: Ensure timer starts immediately when URL pattern is detected
const initializer = initializeAWSCountdownTimer();

} // End of duplicate execution prevention