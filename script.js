// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCe1RF-ktACTKcI7tpW2MfrO6dXGh_UOmo",
    authDomain: "tassk-room.firebaseapp.com",
    databaseURL: "https://tassk-room-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tassk-room",
    storageBucket: "tassk-room.firebasestorage.app",
    messagingSenderId: "733833407300",
    appId: "1:733833407300:web:1b960f1a3fb12e908c4511"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let rooms = {};
let currentRoom = null;
let modalType = '';
let addToParent = null;
let expandedNodes = new Set();
let currentTaskType = 'daily';
let currentTaskPriority = 'high';
let currentFilter = 'all';
let selectedDate = null;
let sortByPriority = false;
let sortByDeadline = false;
let roomListener = null;

function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Create Room - Save to Firebase
function createRoom() {
    const name = document.getElementById('createRoomName').value.trim();
    if (!name) {
        alert('Please enter a room name');
        return;
    }

    const roomId = generateId();
    const roomPass = generateId().substr(0, 6);

    const roomData = {
        name: name,
        password: roomPass,
        items: [],
        createdAt: new Date().toISOString()
    };

    // Save to Firebase
    database.ref('rooms/' + roomId).set(roomData)
        .then(() => {
            alert(`Room created successfully!\n\nRoom ID: ${roomId}\nPassword: ${roomPass}\n\nPlease save these credentials to join this room later.`);
            enterRoom(roomId, roomPass);
        })
        .catch((error) => {
            alert('Error creating room: ' + error.message);
        });
}

// Join Room - Fetch from Firebase
function joinRoom() {
    const roomId = document.getElementById('joinRoomId').value.trim().toUpperCase();
    const roomPass = document.getElementById('joinRoomPass').value.trim();

    if (!roomId || !roomPass) {
        alert('Please enter both Room ID and Password');
        return;
    }

    // Fetch room from Firebase
    database.ref('rooms/' + roomId).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                alert('❌ Room not found!\n\nThis Room ID does not exist. Please check the ID and try again.');
                document.getElementById('joinRoomId').value = '';
                document.getElementById('joinRoomPass').value = '';
                return;
            }

            const roomData = snapshot.val();
            
            if (roomData.password !== roomPass) {
                alert('❌ Incorrect password!\n\nThe password you entered is wrong. Please try again.');
                document.getElementById('joinRoomPass').value = '';
                return;
            }

            // Store room locally
            rooms[roomId] = roomData;
            enterRoom(roomId, roomPass);
        })
        .catch((error) => {
            alert('Error joining room: ' + error.message);
        });
}

// Enter Room and Start Listening for Real-time Updates
function enterRoom(roomId, roomPass) {
    currentRoom = roomId;
    expandedNodes.clear();
    currentFilter = 'all';
    selectedDate = null;
    sortByPriority = false;
    sortByDeadline = false;
    
    document.getElementById('displayRoomId').textContent = roomId;
    document.getElementById('displayRoomPass').textContent = roomPass;
    document.getElementById('datePicker').value = '';
    document.getElementById('priorityToggle').classList.remove('active');
    document.getElementById('deadlineToggle').classList.remove('active');
    
    // Reset filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));
    filterBtns[0].classList.add('active');
    
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Start listening for real-time updates
    startRealtimeListener(roomId);
}

// Real-time Listener - Sync with Firebase
function startRealtimeListener(roomId) {
    // Remove old listener if exists
    if (roomListener) {
        database.ref('rooms/' + currentRoom).off('value', roomListener);
    }

    // Listen for changes in real-time
    roomListener = database.ref('rooms/' + roomId).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const roomData = snapshot.val();
            rooms[roomId] = roomData;
            renderTree();
        }
    }, (error) => {
        console.error('Error listening to room:', error);
    });
}

// Exit Room - Stop Listening
function exitRoom() {
    // Stop listening to Firebase updates
    if (roomListener && currentRoom) {
        database.ref('rooms/' + currentRoom).off('value', roomListener);
        roomListener = null;
    }

    currentRoom = null;
    expandedNodes.clear();
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('createRoomName').value = '';
    document.getElementById('joinRoomId').value = '';
    document.getElementById('joinRoomPass').value = '';
}

function selectTaskType(type) {
    currentTaskType = type;
    const options = document.querySelectorAll('.type-option');
    options.forEach(opt => opt.classList.remove('selected'));
    event.target.closest('.type-option').classList.add('selected');
    
    if (type === 'deadline') {
        document.getElementById('deadlineSection').classList.add('show');
    } else {
        document.getElementById('deadlineSection').classList.remove('show');
    }
}

function selectPriority(priority) {
    currentTaskPriority = priority;
    const options = document.querySelectorAll('.priority-option');
    options.forEach(opt => opt.classList.remove('selected'));
    event.target.closest('.priority-option').classList.add('selected');
}

function showCreateModal(type, parentId) {
    modalType = type;
    addToParent = parentId;
    currentTaskType = 'daily';
    currentTaskPriority = 'high';
    
    document.getElementById('modalTitle').textContent = type === 'task' ? 'Create New Task' : 'Create New Category';
    document.getElementById('modalLabel').textContent = type === 'task' ? 'Task Name' : 'Category Name';
    document.getElementById('modalInput').value = '';
    document.getElementById('deadlineInput').value = '';
    
    if (type === 'task') {
        document.getElementById('taskTypeSection').style.display = 'block';
        document.getElementById('deadlineSection').classList.remove('show');
        
        const typeOptions = document.querySelectorAll('.type-option');
        typeOptions.forEach(opt => opt.classList.remove('selected'));
        typeOptions[0].classList.add('selected');
        
        const priorityOptions = document.querySelectorAll('.priority-option');
        priorityOptions.forEach(opt => opt.classList.remove('selected'));
        priorityOptions[0].classList.add('selected');
    } else {
        document.getElementById('taskTypeSection').style.display = 'none';
        document.getElementById('deadlineSection').classList.remove('show');
    }
    
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    addToParent = null;
}

// Create Item - Save to Firebase
function createItem() {
    const name = document.getElementById('modalInput').value.trim();
    if (!name) {
        alert('Please enter a name');
        return;
    }

    const newItem = {
        id: generateId(),
        name: name,
        type: modalType,
        children: [],
        completed: false
    };

    if (modalType === 'task') {
        newItem.taskType = currentTaskType;
        newItem.priority = currentTaskPriority;
        if (currentTaskType === 'deadline') {
            const deadline = document.getElementById('deadlineInput').value;
            if (!deadline) {
                alert('Please select a deadline date');
                return;
            }
            newItem.deadline = deadline;
        }
    }

    if (addToParent) {
        const parent = findItemById(addToParent);
        if (parent) {
            parent.children.push(newItem);
            expandedNodes.add(addToParent);
        }
    } else {
        rooms[currentRoom].items.push(newItem);
    }

    // Save to Firebase
    saveRoomsToFirebase();
    closeModal();
}

function setFilter(filter) {
    currentFilter = filter;
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderTree();
}

function filterByDate() {
    selectedDate = document.getElementById('datePicker').value;
    renderTree();
}

function clearDateFilter() {
    selectedDate = null;
    document.getElementById('datePicker').value = '';
    renderTree();
}

function togglePrioritySort() {
    sortByPriority = !sortByPriority;
    if (sortByPriority) {
        sortByDeadline = false;
        document.getElementById('deadlineToggle').classList.remove('active');
    }
    document.getElementById('priorityToggle').classList.toggle('active');
    renderTree();
}

function toggleDeadlineSort() {
    sortByDeadline = !sortByDeadline;
    if (sortByDeadline) {
        sortByPriority = false;
        document.getElementById('priorityToggle').classList.remove('active');
    }
    document.getElementById('deadlineToggle').classList.toggle('active');
    renderTree();
}

function findItemById(id, items = rooms[currentRoom].items) {
    for (let item of items) {
        if (item.id === id) return item;
        if (item.children.length > 0) {
            let found = findItemById(id, item.children);
            if (found) return found;
        }
    }
    return null;
}

function toggleExpand(id) {
    if (expandedNodes.has(id)) {
        expandedNodes.delete(id);
    } else {
        expandedNodes.add(id);
    }
    renderTree();
}

// Toggle Task - Save to Firebase
function toggleTask(id, event) {
    event.stopPropagation();
    const item = findItemById(id);
    if (item && item.type === 'task') {
        item.completed = !item.completed;
        saveRoomsToFirebase();
    }
}

// Delete Item - Save to Firebase
function deleteItem(id, event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this item?')) {
        removeItemById(id, rooms[currentRoom].items);
        saveRoomsToFirebase();
    }
}

function removeItemById(id, items) {
    for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) {
            items.splice(i, 1);
            return true;
        }
        if (items[i].children.length > 0) {
            if (removeItemById(id, items[i].children)) {
                return true;
            }
        }
    }
    return false;
}

function isTaskVisible(item) {
    if (item.type === 'category') return true;
    if (item.type !== 'task') return true;

    if (currentFilter === 'daily' && item.taskType !== 'daily') return false;
    if (currentFilter === 'deadline' && item.taskType !== 'deadline') return false;

    if (selectedDate) {
        if (item.taskType === 'daily') return true;
        if (item.taskType === 'deadline' && item.deadline === selectedDate) return true;
        return false;
    }

    return true;
}

function isOverdue(deadline) {
    const today = new Date().toISOString().split('T')[0];
    return deadline < today;
}

function renderTreeNode(item, container) {
    if (!isTaskVisible(item)) return;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item';

    const nodeDiv = document.createElement('div');
    let nodeClass = `tree-node ${item.type}`;
    
    if (item.type === 'task') {
        if (item.priority) {
            nodeClass += ` ${item.priority}-priority`;
        }
        if (item.taskType === 'deadline' && item.deadline && isOverdue(item.deadline) && !item.completed) {
            nodeClass += ' overdue';
        }
    }
    
    nodeDiv.className = nodeClass;

    const hasChildren = item.type === 'category' && item.children.length > 0;
    const isExpanded = expandedNodes.has(item.id);

    if (hasChildren) {
        const expandBtn = document.createElement('button');
        expandBtn.className = `expand-btn ${isExpanded ? 'expanded' : ''}`;
        expandBtn.textContent = '▶';
        expandBtn.onclick = (e) => {
            e.stopPropagation();
            toggleExpand(item.id);
        };
        nodeDiv.appendChild(expandBtn);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'empty-placeholder';
        nodeDiv.appendChild(placeholder);
    }

    if (item.type === 'task') {
        const checkbox = document.createElement('div');
        checkbox.className = `checkbox ${item.completed ? 'checked' : ''}`;
        checkbox.onclick = (e) => toggleTask(item.id, e);
        nodeDiv.appendChild(checkbox);
    } else {
        const icon = document.createElement('span');
        icon.className = 'item-icon';
        icon.textContent = '📁';
        nodeDiv.appendChild(icon);
    }

    const content = document.createElement('div');
    content.className = 'item-content';
    const nameSpan = document.createElement('span');
    nameSpan.className = `item-name ${item.completed ? 'completed' : ''}`;
    nameSpan.textContent = item.name;
    content.appendChild(nameSpan);

    if (item.type === 'task') {
        if (item.taskType === 'daily') {
            const badge = document.createElement('span');
            badge.className = 'task-badge badge-daily';
            badge.textContent = '🔄 Daily';
            content.appendChild(badge);
        } else if (item.taskType === 'deadline') {
            const badge = document.createElement('span');
            if (isOverdue(item.deadline) && !item.completed) {
                badge.className = 'task-badge badge-overdue';
                badge.textContent = `⚠️ Overdue: ${item.deadline}`;
            } else {
                badge.className = 'task-badge badge-deadline';
                badge.textContent = `📅 ${item.deadline}`;
            }
            content.appendChild(badge);
        }
        
        if (item.priority) {
            const priorityBadge = document.createElement('span');
            if (item.priority === 'high') {
                priorityBadge.className = 'task-badge badge-high';
                priorityBadge.textContent = '🔴 High';
            } else if (item.priority === 'medium') {
                priorityBadge.className = 'task-badge badge-medium';
                priorityBadge.textContent = '🟡 Medium';
            } else if (item.priority === 'low') {
                priorityBadge.className = 'task-badge badge-low';
                priorityBadge.textContent = '🟢 Low';
            }
            content.appendChild(priorityBadge);
        }
    }

    nodeDiv.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    if (item.type === 'category') {
        const addTaskBtn = document.createElement('button');
        addTaskBtn.className = 'icon-btn add-task-btn';
        addTaskBtn.textContent = '➕📝';
        addTaskBtn.title = 'Add task';
        addTaskBtn.onclick = (e) => {
            e.stopPropagation();
            showCreateModal('task', item.id);
        };
        actions.appendChild(addTaskBtn);

        const addCategoryBtn = document.createElement('button');
        addCategoryBtn.className = 'icon-btn add-category-btn';
        addCategoryBtn.textContent = '➕📁';
        addCategoryBtn.title = 'Add category';
        addCategoryBtn.onclick = (e) => {
            e.stopPropagation();
            showCreateModal('category', item.id);
        };
        actions.appendChild(addCategoryBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteItem(item.id, e);
    };
    actions.appendChild(deleteBtn);

    nodeDiv.appendChild(actions);
    itemDiv.appendChild(nodeDiv);

    if (hasChildren) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = `tree-children ${isExpanded ? 'expanded' : ''}`;
        item.children.forEach(child => renderTreeNode(child, childrenDiv));
        itemDiv.appendChild(childrenDiv);
    }

    container.appendChild(itemDiv);
}

function renderTree() {
    const container = document.getElementById('treeContainer');
    let items = [...rooms[currentRoom].items];

    if (sortByPriority || sortByDeadline) {
        items = sortItems(items);
    }

    container.innerHTML = '';
    
    let hasVisibleItems = false;
    items.forEach(item => {
        const initialLength = container.children.length;
        renderTreeNode(item, container);
        if (container.children.length > initialLength) {
            hasVisibleItems = true;
        }
    });

    if (!hasVisibleItems) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div>${selectedDate ? 'No tasks for this date' : 'Start by creating a task or category'}</div>
            </div>
        `;
    }
}

function sortItems(items) {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    
    return items.sort((a, b) => {
        if (a.type === 'category' && b.type !== 'category') return -1;
        if (a.type !== 'category' && b.type === 'category') return 1;
        
        if (a.type === 'task' && b.type === 'task') {
            if (sortByPriority) {
                const priorityA = priorityOrder[a.priority] || 999;
                const priorityB = priorityOrder[b.priority] || 999;
                return priorityA - priorityB;
            }
            
            if (sortByDeadline) {
                if (!a.deadline && b.deadline) return 1;
                if (a.deadline && !b.deadline) return -1;
                if (!a.deadline && !b.deadline) return 0;
                return new Date(a.deadline) - new Date(b.deadline);
            }
        }
        
        return 0;
    });
}

// Save to Firebase - Real-time Sync
function saveRoomsToFirebase() {
    if (!currentRoom || !rooms[currentRoom]) return;
    
    database.ref('rooms/' + currentRoom).set(rooms[currentRoom])
        .catch((error) => {
            console.error('Error saving to Firebase:', error);
            alert('Failed to save changes. Please check your internet connection.');
        });
}
