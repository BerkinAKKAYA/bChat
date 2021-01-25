<script>
	const uid = "0bayGCeRXFpwNSJAzW9T";
	const db = firebase.firestore();

	let groups = {};		// History of chats { groupId: { messages: { sentAt: { sendBy, text } } } }
	let userSubscription = null;	// Group subscriptions (call to unsubscribe)
	let groupSubscriptions = [];	// Chat subscriptions (call each to unsubscribe)

	InitializeSubscriptions();

	function InitializeSubscriptions() {
		if (!uid) {
			return alert("No user logged in!");
		}

		userSubscription && userSubscription();

		// Update group subscriptions everytime a new group added or removed.
		userSubscription = db.collection("Users").doc(uid).onSnapshot(doc => {
			// Unsubscribe previous subscriptions
			for (const unsubscribe of groupSubscriptions) {
				unsubscribe();
			}

			const user = doc.data(); // displayName, tel, groups
			groups = {};

			// Update groups array everytime a group gets mutated (a new message arrives)
			for (const groupId of user.groups) {
				db.collection("Groups").doc(groupId).onSnapshot(doc => {
					const history = doc.data();
					groups[groupId] = history;

					// Mutate groups array so Svelte will re-render.
					groups = groups;
				});
			}
		});
	}

	function SendMessage(groupId, message) {
		const ref = db.collection('Groups').doc(groupId);
		const sentAt = Date.now();

		const data = {};
		data[sentAt] = {};
		data[sentAt]["sentBy"] = uid;
		data[sentAt]["text"] = message;

		ref.set(data, { merge: true });
	}

	function AddToGroup(userId, groupId) {
		const ref = db.collection('Users').doc(userId);

		ref.get().then(doc => {
			const data = doc.data();
			data.groups = [...doc.data().groups, groupId];
			ref.set(data);
		}).catch(err => {
			console.error("Error! Probably user does not exists...");
			console.error(err);
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

		ref.add({}).then(docRef => {
			AddToGroup(uid, docRef.id)
			AddToGroup(secondUserId, docRef.id)
		});
	}
</script>

<main>
	{#each Object.keys(groups) as groupId}
		<button>Chat: {groupId}</button>
	{/each}
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
</style>
