document.addEventListener('DOMContentLoaded', () => {
    const draggables = document.querySelectorAll('.draggable');
    const dropZone = document.getElementById('dropZone');
    const message = document.getElementById('message');
    const verifyBtn = document.getElementById('verifyBtn');

    // State variables
    let isVerified = false;
    let startTime = Date.now(); // Track from page load
    let dragAttempts = 0;
    let successfulDrop = false;
    let pathPoints = [];
    let isDragging = false;
    let isTracking = true;

    // Add these at the start of your DOMContentLoaded event
    const ROBOT_EMOJIS = [
        { emoji: '🤖', name: 'robot' }
    ];

    const DECOY_EMOJIS = [
        '🌟', '🎈', '🎮', '🎪', '🎨', '🎭', '🎯', 
        '🎵', '🎬', '📱', '🎹', '🎸', '🌈', '⭐'
    ];

    let targetEmoji = ROBOT_EMOJIS[0];
    let firstMove = false;
    let firstMoveTime = null;
    let foundTargetTime = null;

    // Update instructions immediately
    document.querySelector('.container p').textContent = 
        `Drag the ${targetEmoji.name} ${targetEmoji.emoji} to the box to verify`;

    // Start tracking mouse movement immediately
    document.addEventListener('mousemove', (e) => {
        if (isTracking) {
            pathPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                isDragging: isDragging
            });
        }
    });

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            isDragging = true;
            e.dataTransfer.setData('text/plain', e.target.innerHTML);
            e.target.classList.add('dragging');
        });

        draggable.addEventListener('dragend', (e) => {
            isDragging = false;
            e.target.classList.remove('dragging');
        });
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
        
        dragAttempts++;
        
        const droppedEmoji = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector('.dragging');
        
        if (droppedEmoji === targetEmoji.emoji) {
            // Add vanish animation to the original emoji
            if (draggedElement) {
                draggedElement.classList.add('vanish');
                draggedElement.addEventListener('animationend', () => {
                    draggedElement.remove();
                });
            }
            
            // Set the emoji in drop zone with consistent styling
            dropZone.innerHTML = droppedEmoji;
            dropZone.style.fontSize = '2rem'; // Match the draggable emoji size
            dropZone.style.display = 'flex';
            dropZone.style.alignItems = 'center';
            dropZone.style.justifyContent = 'center';
            
            foundTargetTime = Date.now();
            successfulDrop = true;
            message.style.color = 'green';
            message.textContent = 'Correct! You can now verify.';
            verifyBtn.disabled = false;
        } else {
            successfulDrop = false;
            message.style.color = 'red';
            message.textContent = 'Wrong object! Try again.';
            verifyBtn.disabled = true;
            
            if (draggedElement) {
                draggedElement.style.opacity = '1';
                draggedElement.classList.remove('dragging');
            }
            
            setTimeout(() => {
                dropZone.innerHTML = 'Drop Zone';
                dropZone.style.fontSize = '1.2rem';
            }, 1000);
        }
    });

    verifyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (successfulDrop) {
            const metrics = calculateMetrics();
            
            // Simplified bot detection - just check the basics
            const isSuspicious = 
                metrics.searchTime < 0.2 || // Too fast to be human
                pathPoints.length < 5;      // Too few movement points
            
            if (isSuspicious) {
                // Show standard CAPTCHA-style message
                showFailure("Verification failed. Please try again.");
                return;
            }
            
            // If passed, show success and metrics
            showMetricsModal(dragAttempts, metrics.totalTime);
        }
    });

    // Add this function to handle resetting the captcha
    function resetCaptcha() {
        dropZone.innerHTML = 'Drop Zone';
        dropZone.style.fontSize = '1.2rem';
        message.textContent = '';
        verifyBtn.textContent = 'Verify';
        verifyBtn.disabled = true;
        dragAttempts = 0;
        successfulDrop = false;
        dragStartTime = 0;
        cursorPath = [];
        isTracking = true;
    }

    function drawDragPath(canvas, points) {
        const ctx = canvas.getContext('2d');
        
        // Clear any previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set canvas size to match its display size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Calculate scale to fit everything in view
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));
        
        const padding = 20;
        const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1); // Prevent division by zero
        const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);
        const scale = Math.min(scaleX, scaleY);
        
        // Transform coordinates to fit canvas
        const transformPoint = (p) => ({
            x: (p.x - minX) * scale + padding,
            y: (p.y - minY) * scale + padding
        });
        
        // Draw container box
        const container = document.querySelector('.container');
        const containerRect = container.getBoundingClientRect();
        const transformedContainer = {
            left: (containerRect.left - minX) * scale + padding,
            top: (containerRect.top - minY) * scale + padding,
            width: containerRect.width * scale,
            height: containerRect.height * scale
        };
        
        // Draw container box in red
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            transformedContainer.left,
            transformedContainer.top,
            transformedContainer.width,
            transformedContainer.height
        );

        // Draw paths
        if (points.length > 1) {
            let lastPoint = transformPoint(points[0]);
            
            for (let i = 1; i < points.length; i++) {
                const point = transformPoint(points[i]);
                
                ctx.beginPath();
                ctx.moveTo(lastPoint.x, lastPoint.y);
                ctx.lineTo(point.x, point.y);
                
                // Debug log to check isDragging state
                console.log(`Point ${i}:`, {
                    isDragging: points[i].isDragging,
                    x: point.x,
                    y: point.y
                });
                
                if (points[i].isDragging) {
                    ctx.strokeStyle = '#007bff';
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = '#666666';
                    ctx.lineWidth = 1;
                }
                
                ctx.stroke();
                lastPoint = point;
            }
        }

        // Draw legend
        ctx.font = '12px Arial';
        
        // Normal movement legend
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, canvas.height - 45);
        ctx.lineTo(50, canvas.height - 45);
        ctx.stroke();
        ctx.fillText('Normal Movement', 60, canvas.height - 40);

        // Drag movement legend
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, canvas.height - 25);
        ctx.lineTo(50, canvas.height - 25);
        ctx.stroke();
        ctx.fillText('Drag Movement', 60, canvas.height - 20);

        // Container box legend
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, canvas.height - 5);
        ctx.lineTo(50, canvas.height - 5);
        ctx.stroke();
        ctx.fillText('Drop Zone', 60, canvas.height);
    }

    function calculatePathDeviation() {
        if (pathPoints.length < 2) return 0;
        
        // Calculate average deviation from straight line
        const start = pathPoints[0];
        const end = pathPoints[pathPoints.length - 1];
        
        let totalDeviation = 0;
        pathPoints.forEach(point => {
            // Calculate distance from point to straight line
            const deviation = pointToLineDistance(start, end, point);
            totalDeviation += deviation;
        });
        
        return totalDeviation / pathPoints.length;
    }

    function pointToLineDistance(lineStart, lineEnd, point) {
        const numerator = Math.abs(
            (lineEnd.y - lineStart.y) * point.x -
            (lineEnd.x - lineStart.x) * point.y +
            lineEnd.x * lineStart.y -
            lineEnd.y * lineStart.x
        );
        
        const denominator = Math.sqrt(
            Math.pow(lineEnd.y - lineStart.y, 2) +
            Math.pow(lineEnd.x - lineStart.x, 2)
        );
        
        return numerator / denominator;
    }

    // Add confetti function
    function createConfetti() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        const confettiCount = 150;
        const gravity = 0.5;
        const terminalVelocity = 5;
        const drag = 0.075;
        const confettis = [];
        
        class Confetti {
            constructor() {
                this.x = Math.random() * window.innerWidth;
                this.y = Math.random() * window.innerHeight * -1;
                this.rotation = Math.random() * 360;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.size = Math.random() * (6 - 3) + 3;
                this.velocityX = Math.random() * (3 - -3) + -3;
                this.velocityY = Math.random() * (3 - -3) + -3;
                this.terminalVelocity = terminalVelocity;
                this.rotationSpeed = Math.random() * (0.2 - -0.2) + -0.2;
            }
            
            update() {
                this.velocityY += gravity;
                this.x += this.velocityX;
                this.y += this.velocityY;
                this.rotation += this.rotationSpeed;
                
                if (this.velocityY > this.terminalVelocity) {
                    this.velocityY = this.terminalVelocity;
                }
                
                this.velocityX *= (1 - drag);
                this.velocityY *= (1 - drag);
            }
        }
        
        // Create canvas for confetti
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Create confetti pieces
        for (let i = 0; i < confettiCount; i++) {
            confettis.push(new Confetti());
        }
        
        let animationFrame;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            confettis.forEach((confetti, index) => {
                confetti.update();
                
                // Draw confetti
                ctx.beginPath();
                ctx.moveTo(confetti.x, confetti.y);
                ctx.lineTo(confetti.x + confetti.size, confetti.y + confetti.size);
                ctx.lineTo(confetti.x + confetti.size, confetti.y + confetti.size * 2);
                ctx.lineTo(confetti.x, confetti.y + confetti.size * 2);
                ctx.closePath();
                
                ctx.fillStyle = confetti.color;
                ctx.strokeStyle = confetti.color;
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
                
                // Remove confetti if it's off screen
                if (confetti.y > canvas.height) {
                    confettis.splice(index, 1);
                }
            });
            
            if (confettis.length > 0) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                cancelAnimationFrame(animationFrame);
                canvas.remove();
            }
        }
        
        animate();
    }

    // Update the success verification to include confetti
    function showMetricsModal(attempts, totalTime) {
        const deviation = calculatePathDeviation() || 0;
        const totalDistance = calculateTotalCursorDistance() || 0;
        const accuracy = calculateAccuracy(pathPoints) || 0;
        const humanLikelihood = Math.max(0, Math.min(100, 100 - accuracy)) || 0;

        const modalHTML = `
            <div class="metrics-modal">
                <div class="modal-content">
                    <h2>Verification Analysis</h2>
                    <div class="metrics">
                        <p>🎯 Attempts needed: ${attempts}</p>
                        <p>⏱️ Total time: ${totalTime.toFixed(2)} seconds</p>
                        <p>🎮 Path Deviation: ${deviation.toFixed(1)}px</p>
                        <p>🔄 Total cursor distance: ${totalDistance.toFixed(0)}px</p>
                        <p>🎭 Human-like Movement Score: ${humanLikelihood.toFixed(1)}%</p>
                        <p class="movement-analysis">${getMovementAnalysis(humanLikelihood)}</p>
                    </div>
                    <canvas id="pathCanvas" class="path-canvas"></canvas>
                    <p class="analysis">Analysis shows your complete cursor movement pattern from page load to successful verification.</p>
                    <div class="modal-buttons">
                        <button id="closeModalBtn">Close</button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.querySelector('.metrics-modal');
        const closeModalBtn = document.getElementById('closeModalBtn');
        
        const canvas = document.getElementById('pathCanvas');
        canvas.style.width = '100%';
        canvas.style.height = '200px';
        canvas.style.marginTop = '15px';
        canvas.style.border = '1px solid #ddd';
        canvas.style.borderRadius = '4px';
        
        requestAnimationFrame(() => {
            drawDragPath(canvas, pathPoints);
        });

        closeModalBtn.addEventListener('click', () => {
            modal.remove();
        });

        // Add confetti explosion on success
        createConfetti();
    }

    function calculateTotalCursorDistance() {
        let total = 0;
        for (let i = 1; i < pathPoints.length; i++) {
            total += Math.hypot(
                pathPoints[i].x - pathPoints[i-1].x,
                pathPoints[i].y - pathPoints[i-1].y
            );
        }
        return total;
    }

    // Add at the start
    const containerRect = document.querySelector('.container').getBoundingClientRect();
    let cursorPath = [];
    

    // Track all cursor movement
    document.addEventListener('mousemove', (e) => {
        if (isTracking) {
            cursorPath.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            });
        }
    });

    function getRandomPositionOutsideContainer() {
        const padding = 20; // Minimum distance from edges
        const containerPadding = 50; // Minimum distance from container
        
        // Get a random position
        let x, y;
        do {
            x = padding + Math.random() * (window.innerWidth - 2 * padding);
            y = padding + Math.random() * (window.innerHeight - 2 * padding);
        } while (
            // Keep trying until we get a position that's not too close to the container
            x > (containerRect.left - containerPadding) && 
            x < (containerRect.right + containerPadding) &&
            y > (containerRect.top - containerPadding) && 
            y < (containerRect.bottom + containerPadding)
        );

        return { x, y };
    }

    function initializeEmojis() {
        const draggables = document.querySelectorAll('.draggable');
        
        draggables.forEach(draggable => {
            const pos = getRandomPositionOutsideContainer();
            draggable.style.position = 'fixed';
            draggable.style.left = pos.x + 'px';
            draggable.style.top = pos.y + 'px';
            
            // Make sure draggable attribute is set
            draggable.setAttribute('draggable', 'true');
            
            // Add hover effect
            draggable.addEventListener('mouseenter', () => {
                if (!draggable.classList.contains('dragging')) {
                    draggable.style.transform = 'scale(1.2)';
                }
            });
            
            draggable.addEventListener('mouseleave', () => {
                if (!draggable.classList.contains('dragging')) {
                    draggable.style.transform = 'scale(1)';
                }
            });
        });
    }

    // Update window resize handler
    window.addEventListener('resize', () => {
        const draggables = document.querySelectorAll('.draggable');
        draggables.forEach(draggable => {
            if (!draggable.classList.contains('dragging')) {
                const pos = getRandomPositionOutsideContainer();
                draggable.style.left = pos.x + 'px';
                draggable.style.top = pos.y + 'px';
            }
        });
    });

    // Initialize emojis
    initializeEmojis();

    // Add this function to calculate accuracy
    function calculateAccuracy(pathPoints) {
        if (pathPoints.length < 2) return 0;  // Return 0 instead of 100 for insufficient data

        let straightnessScore = 0;
        let velocityChanges = 0;
        let lastVelocity = null;

        try {
            for (let i = 1; i < pathPoints.length; i++) {
                // Add safety checks for timestamp differences
                const dt = Math.max(1, pathPoints[i].timestamp - pathPoints[i-1].timestamp); // Prevent division by zero
                const dx = pathPoints[i].x - pathPoints[i-1].x;
                const dy = pathPoints[i].y - pathPoints[i-1].y;
                const currentVelocity = Math.sqrt(dx*dx + dy*dy) / dt;

                if (lastVelocity !== null) {
                    const velocityDiff = Math.abs(currentVelocity - lastVelocity);
                    if (velocityDiff > 2) velocityChanges++;
                }
                lastVelocity = currentVelocity;

                if (i > 1) {
                    const deviation = pointToLineDistance(
                        pathPoints[i-2],
                        pathPoints[i],
                        pathPoints[i-1]
                    );
                    straightnessScore += deviation;
                }
            }

            straightnessScore = Math.min(100, (straightnessScore / pathPoints.length) * 5);
            const velocityScore = Math.min(100, (velocityChanges / pathPoints.length) * 50);

            return Math.max(0, 80 - ((straightnessScore + velocityScore) / 2)) || 0; // Return 0 if NaN
        } catch (error) {
            console.error('Error calculating accuracy:', error);
            return 0; // Return 0 on error
        }
    }

    // Add this function to get movement analysis message
    function getMovementAnalysis(humanLikelihood) {
        if (humanLikelihood > 80) {
            return "Movement patterns are very natural and human-like";
        } else if (humanLikelihood > 60) {
            return "Movement shows good natural variation";
        } else if (humanLikelihood > 40) {
            return "Movement patterns are acceptable";
        } else if (humanLikelihood > 20) {
            return "Movement could be more natural";
        } else {
            return "Please try moving more naturally";
        }
    }

    function initializeGame() {
        // No need to randomly select - we only have one robot emoji
        targetEmoji = ROBOT_EMOJIS[0];
        
        // Update instructions
        document.querySelector('.container p').textContent = 
            `Drag the ${targetEmoji.name} ${targetEmoji.emoji} to the box to verify`;

        // Create random selection of decoy emojis (reduce number of decoys)
        const selectedDecoys = shuffleArray(DECOY_EMOJIS).slice(0, 5); // Reduced from 7
        const allEmojis = shuffleArray([targetEmoji.emoji, ...selectedDecoys]);
        
        // Clear existing emojis
        const container = document.querySelector('.objects-container');
        container.innerHTML = '';

        // Create new emojis with random positions
        allEmojis.forEach(emoji => {
            const pos = getRandomPositionOutsideContainer();
            const div = document.createElement('div');
            div.className = 'draggable';
            div.draggable = true;
            div.innerHTML = emoji;
            div.style.position = 'fixed';
            div.style.left = pos.x + 'px';
            div.style.top = pos.y + 'px';
            div.style.fontSize = '2rem';
            div.style.zIndex = '1000';
            container.appendChild(div);

            div.addEventListener('dragstart', (e) => {
                isDragging = true;
                e.dataTransfer.setData('text/plain', e.target.innerHTML);
                div.classList.add('dragging');
                document.body.classList.add('dragging-cursor');
                
                // Set empty drag image
                const img = new Image();
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                e.dataTransfer.setDragImage(img, 0, 0);
                
                // Hide original element
                div.style.opacity = '0';
            });

            div.addEventListener('dragend', (e) => {
                isDragging = false;
                div.classList.remove('dragging');
                document.body.classList.remove('dragging-cursor');
                
                const dropZoneRect = dropZone.getBoundingClientRect();
                const isInDropZone = e.clientX >= dropZoneRect.left && 
                                   e.clientX <= dropZoneRect.right && 
                                   e.clientY >= dropZoneRect.top && 
                                   e.clientY <= dropZoneRect.bottom;
                
                if (!isInDropZone) {
                    div.style.opacity = '1';
                    div.style.left = (e.clientX - div.offsetWidth / 2) + 'px';
                    div.style.top = (e.clientY - div.offsetHeight / 2) + 'px';
                }
            });

            // Add hover effect
            div.addEventListener('mouseenter', () => {
                if (!isDragging) {
                    div.style.transform = 'scale(1.1)';
                    div.style.transition = 'transform 0.2s ease';
                }
            });
            
            div.addEventListener('mouseleave', () => {
                if (!isDragging) {
                    div.style.transform = 'scale(1)';
                }
            });
        });

        // Add mousemove handler to update cursor position
        document.addEventListener('dragover', (e) => {
            const cursor = document.getElementById('dragCursor');
            if (cursor && isDragging) {
                cursor.style.left = e.clientX + 'px';
                cursor.style.top = e.clientY + 'px';
            }
        });
    }

    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // Add time-based token
    function generateToken() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        return `${timestamp}.${random}`;
    }

    let validationToken = generateToken();

    // Track when user starts moving
    document.addEventListener('mousemove', (e) => {
        if (!firstMove) {
            firstMove = true;
            firstMoveTime = Date.now();
        }
        // ... existing mousemove code ...
    });

    // Update metrics calculation to include search time
    function calculateMetrics() {
        const searchTime = (foundTargetTime - firstMoveTime) / 1000;
        const totalTime = (Date.now() - startTime) / 1000;
        const accuracy = calculateAccuracy(pathPoints);
        const humanLikelihood = calculateHumanLikelihood(searchTime, accuracy);
        
        return {
            searchTime,
            totalTime,
            accuracy,
            humanLikelihood
        };
    }

    function calculateHumanLikelihood(searchTime, accuracy) {
        // Adjust time scoring - more lenient ranges
        const timeScore = searchTime < 0.2 ? 0 : 
                         searchTime < 5 ? 100 : 
                         Math.max(0, 100 - ((searchTime - 5) * 10));
        
        // Combine with movement accuracy (weighted average)
        // Reduce accuracy weight to make it less sensitive
        return (timeScore * 0.6) + (accuracy * 0.4);
    }

    function showFailure(message) {
        const modalHTML = `
            <div class="metrics-modal">
                <div class="modal-content">
                    <h2>Verification Failed</h2>
                    <p>🤖 ${message}</p>
                    <p class="bot-warning">Our system detected patterns that appear automated.</p>
                    <div class="failure-details">
                        <p>This could be due to:</p>
                        <ul>
                            <li>Movement that's too precise or straight</li>
                            <li>Finding the target too quickly</li>
                            <li>Unnatural cursor patterns</li>
                        </ul>
                    </div>
                    <div class="modal-buttons">
                        <button id="tryAgainBtn" class="primary-button">Try Again as Human</button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.querySelector('.metrics-modal');
        const tryAgainBtn = document.getElementById('tryAgainBtn');
        
        // Add some CSS animation for the failure modal
        modal.style.animation = 'shake 0.5s ease-in-out';
        
        tryAgainBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    // Consolidate all styles into one declaration
    const style = document.createElement('style');
    style.textContent = `
        .bot-warning {
            color: #ff4444;
            font-weight: bold;
            margin: 15px 0;
        }

        .failure-details {
            background: #f8f8f8;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }

        .failure-details ul {
            margin: 10px 0;
            padding-left: 20px;
        }

        .primary-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s ease;
        }

        .primary-button:hover {
            background: #0056b3;
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }

        .path-canvas {
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .draggable {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            cursor: grab;
        }
        
        .dragging {
            opacity: 0 !important;
        }

        /* Cursor styles during drag */
        .dragging-cursor {
            cursor: grabbing !important;
        }

        /* Add this to the body during drag */
        body.dragging-cursor {
            cursor: grabbing !important;
        }

        body.dragging-cursor * {
            cursor: grabbing !important;
        }

        .vanish {
            animation: vanishAnimation 0.5s ease-out forwards;
        }

        @keyframes vanishAnimation {
            0% {
                opacity: 1;
                transform: scale(1);
            }
            100% {
                opacity: 0;
                transform: scale(0);
            }
        }

        .drag-cursor {
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            font-size: 2rem;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease;
            animation: pulseScale 1s infinite;
        }

        @keyframes pulseScale {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.1); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }

        .credit-text {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            font-family: 'Arial', sans-serif;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
            background: rgba(0, 0, 0, 0.2);
            padding: 8px 12px;
            border-radius: 8px;
            backdrop-filter: blur(5px);
            text-decoration: none;
            transition: all 0.3s ease;
            z-index: 1000;
        }

        .credit-text:hover {
            color: rgba(255, 255, 255, 0.9);
            background: rgba(0, 0, 0, 0.3);
            transform: translateX(-50%) translateY(-2px);
        }
    `;
    document.head.appendChild(style);

    // Initialize game on page load
    document.addEventListener('DOMContentLoaded', () => {
        initializeGame();
        // ... rest of existing initialization code ...
    });

 
    // Update mouse movement tracking
    document.addEventListener('mousemove', (e) => {
        if (isTracking) {
            pathPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                isDragging: isDragging
            });
        }
    });

    // Track drag events
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('draggable')) {
            isDragging = true;
            // Add drag start point
            pathPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                isDragging: true
            });
        }
    }, true);

    document.addEventListener('drag', (e) => {
        if (isDragging && e.clientX !== 0 && e.clientY !== 0) { // Filter out invalid coordinates
            pathPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                isDragging: true
            });
        }
    }, true);

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('draggable')) {
            // Add final drag point
            pathPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                isDragging: true
            });
            isDragging = false;
        }
    }, true);

    // Add document-level drop handler to prevent default browser behavior
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    // Add these document-level handlers
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            // Check if we're over the drop zone
            const dropZoneRect = dropZone.getBoundingClientRect();
            const isOverDropZone = e.clientX >= dropZoneRect.left && 
                                 e.clientX <= dropZoneRect.right && 
                                 e.clientY >= dropZoneRect.top && 
                                 e.clientY <= dropZoneRect.bottom;
            
            if (!isOverDropZone) {
                // Update position while dragging (optional, for live feedback)
                draggable.style.left = (e.clientX - draggable.offsetWidth / 2) + 'px';
                draggable.style.top = (e.clientY - draggable.offsetHeight / 2) + 'px';
            }
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            // Check if we're over the drop zone
            const dropZoneRect = dropZone.getBoundingClientRect();
            const isOverDropZone = e.clientX >= dropZoneRect.left && 
                                 e.clientX <= dropZoneRect.right && 
                                 e.clientY >= dropZoneRect.top && 
                                 e.clientY <= dropZoneRect.bottom;
            
            if (!isOverDropZone) {
                // Update final position
                draggable.style.left = (e.clientX - draggable.offsetWidth / 2) + 'px';
                draggable.style.top = (e.clientY - draggable.offsetHeight / 2) + 'px';
            }
        }
    });

    // Add the credit text to the page
    const creditText = document.createElement('a');
    creditText.href = 'https://github.com/ashfelloff';
    creditText.className = 'credit-text';
    creditText.textContent = 'by ashfelloff';
    creditText.target = '_blank';
    document.body.appendChild(creditText);
}); 
