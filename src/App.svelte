<script>
	import { toDate, formatDistanceToNow } from "date-fns";
	import { tr } from 'date-fns/locale'
	const uid = "0bayGCeRXFpwNSJAzW9T";
	const db = firebase.firestore();

	let groups = {};				// History of chats { groupId: { messages: { sentAt: { sendBy, text } } } }
	let userSubscription = null;	// Group subscriptions (call to unsubscribe)
	let groupSubscriptions = [];	// Chat subscriptions (call each to unsubscribe)
	
	let focusedGroupId = "";
	let messageToSend = "";

	InitializeSubscriptions();

	// When URL changes, update focusedGroupId
	window.addEventListener("hashchange", e => {
		const hash = window.location.hash.replace("#", "");
		const groupExists = Object.keys(groups).includes(hash)
		focusedGroupId = groupExists ? hash : "";
	})

	// Subscribe to updates on the chats (new messages, new users etc.)
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

					const messages = groups[groupId].messages;
					const orderedMessages = Object.keys(messages).sort().reduce(
						(obj, key) => { 
							obj[key] = messages[key]; 
							return obj;
						}, {}
					);
					groups[groupId].messages = orderedMessages;

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

		// Strucuture of the generated data
		// data.messages = { timestamp: { uid, message }, ... }

		// Generate data
		const sentAt = Date.now();
		const data = { messages: {} };
		data["messages"][sentAt] = {};
		data["messages"][sentAt]["sentBy"] = uid;
		data["messages"][sentAt]["text"] = message;

		// Send the generated data to the firebase
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
		if (!confirm("Emin misiniz?")) { return }

		// Remove the 'groupId' from the user's 'groups' array
		db.collection('Users').doc(uid).get().then(doc => {
			const data = doc.data();
			data.groups = data.groups.filter(x => x != groupId);
			ref.set(data);
		});

		// Go back home
		focusedGroupId = "";
	}

	function CreateGroup(secondUserId) {
		const ref = db.collection('Groups');

		// Empty Group Data Structure (Only initialize 'users')
		const data = { messages: {}, users: [ uid, secondUserId ] };

		// Add the 'data' to the firebase
		ref.add(data).then(docRef => {
			// Add yourself and the secondUser to the group
			AddToGroup(uid, docRef.id);
			AddToGroup(secondUserId, docRef.id);
		});
	}
	
	// Convert Date.now() to Turkish relative time (... ago)
	function RelativeFormat(timestamp) {
		const date = toDate(parseInt(timestamp));
		const dist = formatDistanceToNow(date, { locale: tr }) + " önce";
		const firstWord = dist.substr(0, dist.indexOf(" "));

		if (dist == "bir dakikadan az önce") {
			return "şimdi";
		}

		if (firstWord == "yaklaşık") {
			return dist.substr(dist.indexOf(" ") + 1);
		} else {
			return dist;
		}
	}
	
	async function PromptToCreateGroup() {
		const phone = PromptPhoneNumber();
		const uidToAdd = await GetUIDOfPhone(phone);

		// Given UID does not exists...
		if (!uidToAdd) {
			return alert("Kullanıcı henüz bChat hesabı oluşturmamış.");
		}

		// Given UID belogs to the logged in user...
		if (uidToAdd == uid) {
			return alert("Kendinizle sohbet başlatamazsınız.");
		}

		CreateGroup(uidToAdd);
	}

	async function PromptToAddToGroup(groupId) {
		const phone = PromptPhoneNumber();
		const uidToAdd = await GetUIDOfPhone(phone);

		// Given UID does not exists...
		if (!uidToAdd) {
			return alert("Kullanıcı henüz bChat hesabı oluşturmamış.");
		}

		const usersOfGroup = Object.keys(groups[groupId].users);
		const alreadyInGroup = usersOfGroup.includes(uidToAdd);

		if (alreadyInGroup) {
			return alert("Kullanıcı zaten grupta.");
		}

		AddToGroup(uidToAdd, groupId);
	}

	// Gets a phone number and returns UID of related number.
	async function GetUIDOfPhone(phone) {
		const snapshot = await db.collection("Users").where("tel", "==", phone).get();
		let docId = null;
		snapshot.forEach(doc => {
			if (doc.exists) { docId = doc.id; }
		})
		return docId;
	}

	// Contacts API will be used here...
	function PromptPhoneNumber() {
		let phone = prompt("Telefon Numarası");

		// Remove Whitespace
		phone = phone.replace(/\s/g,'');

		// Remove country section
		if (phone.startsWith("+")) {
			phone = phone.substring(3);
		}

		return parseInt(phone);
	}
</script>

<main>
	<h1>bChat</h1>

	{#if focusedGroupId}
		<a href='/'>Go Back</a>
		<button on:click={() => { PromptToAddToGroup(focusedGroupId) }}>Kişi Ekle</button>
		<button on:click={() => { LeaveGroup(focusedGroupId) }}>Gruptan Çık</button>

		<hr />

		{#each Object.entries(groups[focusedGroupId].messages) as [sentAt, message]}
			<p class:received={message.sentBy == uid}>
				{RelativeFormat(sentAt)} =- {message.text}
			</p>
		{/each}

		<input type="text" bind:value={messageToSend} placeholder="Mesaj" />
		<button on:click={() => SendMessage(focusedGroupId, messageToSend)}>GÖNDER</button>
	{:else}
		<button on:click={PromptToCreateGroup}>Konuşma Başlat</button>

		<hr />

		<div id="groups">
			{#each Object.entries(groups) as [groupId, group]}
				<a href={`#${groupId}`} class="linkToGroup">
					{Object.values(group.users)}
				</a>
			{/each}
		</div>
	{/if}
</main>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		text-decoration: none;
	}
	main {
		padding: 10px;
	}
	button {
		padding: 10px;
		margin: 10px;
	}
	#groups {
		margin: 10px;
	}
	.linkToGroup {
		padding: 10px;
		background: #eee;
		color: #000;
		display: block;
		margin: 10px 0;
	}
</style>
