<script>
	const uid = "0bayGCeRXFpwNSJAzW9T";
	const db = firebase.firestore();

	let groups = {};				// History of chats { groupId: { messages: { sentAt: { sendBy, text } } } }
	let userSubscription = null;	// Group subscriptions (call to unsubscribe)
	let groupSubscriptions = [];	// Chat subscriptions (call each to unsubscribe)
	
	let focusedGroupId = "";

	InitializeSubscriptions();

	function InitializeSubscriptions() {
		if (!uid) {
			return alert("No user logged in!");
		}

		userSubscription && userSubscription();

		const usersCollection = db.collection("Users");

		// Update group subscriptions everytime a new group added or removed.
		userSubscription = usersCollection.doc(uid).onSnapshot(doc => {
			// Unsubscribe previous subscriptions
			for (const unsubscribe of groupSubscriptions) {
				unsubscribe();
			}

			const user = doc.data(); // displayName, tel, groups
			groups = {};

			// Update groups array everytime a group gets mutated (a new message arrives)
			for (const groupId of user.groups) {
				db.collection("Groups").doc(groupId).onSnapshot(doc => {
					const group = doc.data();
					groups[groupId] = group;

					// Convert userArray to userMap ([userId] to {userId: displayName})
					const userArray = groups[groupId]["users"];
					const userMap = {};
					for (const userId of userArray) {
						usersCollection.doc(userId).get().then(doc => {
							userMap[userId] = doc.data().displayName;

							// Mutate groups array so Svelte will re-render.
							groups = groups;
						});
					}
					groups[groupId]["users"] = userMap;
				});
			}
		});
	}

	function SendMessage(groupId, message) {
		const ref = db.collection('Groups').doc(groupId);
		const sentAt = Date.now();

		const data = { messages: {} };
		data["messages"][sentAt] = {};
		data["messages"][sentAt]["sentBy"] = uid;
		data["messages"][sentAt]["text"] = message;

		ref.set(data, { merge: true });
	}

	function AddToGroup(userId, groupId) {
		const usersDoc = db.collection('Users').doc(userId);
		const groupDoc = db.collection('Groups').doc(groupId);

		// Add group to the user
		usersDoc.get().then(doc => {
			const data = doc.data();
			data.groups = [...new Set([...data.groups, groupId])];
			usersDoc.set(data);
		});

		// Add user to the group
		groupDoc.get().then(doc => {
			const data = doc.data();
			data.users = [...new Set([...data.users, userId])];
			groupDoc.set(data);
		});
	}

	function LeaveGroup(groupId) {
		const ref = db.collection('Users').doc(uid);

		ref.get().then(doc => {
			const data = doc.data();
			data.groups = data.groups.filter(x => x != groupId);
			ref.set(data);
		});
	}

	function CreateGroup(secondUserId) {
		const ref = db.collection('Groups');
		const data = { messages: {}, users: [ uid, secondUserId ] };

		ref.add(data).then(docRef => {
			AddToGroup(uid, docRef.id);
			AddToGroup(secondUserId, docRef.id);
		});
	}

	function GetDisplayName(userId) {
		return db.collection('Users').doc(userId).get().then(doc => {
			return doc.data().displayName;
		});
	}
</script>

<main>
	<h1>bChat</h1>

	{#if focusedGroupId}
		<button on:click={() => { focusedGroupId = "" }}>
			Go Back
		</button>
	{:else}
		{#each Object.entries(groups) as [groupId, group]}
			<button on:click={() => { focusedGroupId = groupId }}>
				{Object.values(group.users)}
			</button>
		{/each}
	{/if}
</main>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}
	main {
		padding: 10px;
	}
	button {
		padding: 10px;
		margin: 10px;
	}
</style>
