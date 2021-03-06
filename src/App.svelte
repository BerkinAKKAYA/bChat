<script>
	import Home from './Home.svelte';
	import Chat from './Chat.svelte';
	import Login from './Login.svelte';

	import firebase from "firebase/app";
	import "firebase/analytics";
	import "firebase/firestore";
	import "firebase/auth";

	let uid = "";
	let groups = {};				// History of chats { groupId: { messages: { sentAt: { sendBy, text } } } }
	let userSubscription = null;	// Group subscriptions (call to unsubscribe)
	let groupSubscriptions = [];	// Chat subscriptions (call each to unsubscribe)
	
	let focusedGroupId = "";

	InitializeFirebase();

	const usersCollection = db.collection("Users");
	const groupsCollection = db.collection("Groups");

	// When URL changes, update focusedGroupId
	window.addEventListener("hashchange", e => {
		const hash = window.location.hash.replace("#", "");
		const groupExists = Object.keys(groups).includes(hash)
		focusedGroupId = groupExists ? hash : "";
	})

	// On Sign In / Out
    auth.onAuthStateChanged(user => {
		// Just Signed Out
		if (!user) {
			uid = "";
			return;
		}

		// Sign In
		usersCollection.doc(user.uid).get().then(doc => {
			if (doc.exists) {
				// User Already Have An Account, Sign In
				uid = user.uid;
				InitializeSubscriptions();
			} else {
				// Create An Account & Sign In
				const data = {
					displayName: "",
					groups: [],
					tel: 0
				};
				data.displayName = prompt("Ad & Soyad");
				data.tel = parseInt(user.phoneNumber.replace("+90", ""));

				// Add the 'data' to the firebase
				usersCollection.doc(user.uid).set(data).then(() => {
					uid = user.uid;
					InitializeSubscriptions();
				});
			}
		});
	});

	// Subscribe to updates on the chats (new messages, new users etc.)
	// Call this when the user logged in
	function InitializeSubscriptions() {
		if (!uid) { return alert("No user logged in!"); }

		// Unsubscribe if already subscribed
		userSubscription && userSubscription();

		// Go To Home Page
		window.location.hash = "#";

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
				groupsCollection.doc(groupId).onSnapshot(doc => {
					if (!doc.exists) { return console.log(groupId, "does not exists!") }

					const group = doc.data();
					groups[groupId] = group;
					SortMessagesOf(groupId);
					LinkNamesWithIDs(groupId);

					// Vibrate if received message is not from the focused group
					if (groupId != focusedGroupId) {
						window.navigator.vibrate(200);
					}
				});
			}
		});
	}

	function SortMessagesOf(groupId) {
		const messages = groups[groupId].messages;
		const orderedMessages = Object.keys(messages).sort().reduce(
			(obj, key) => { 
				obj[key] = messages[key]; 
				return obj;
			}, {}
		);
		groups[groupId].messages = orderedMessages;
	}

	// Convert [ userId ] to { userId: displayName }
	function LinkNamesWithIDs(groupId) {
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
	}

	// Gets a phone number and returns UID of related number.
	function GetUIDOfPhone(phone) {
		return usersCollection.where("tel", "==", phone).get().then(snapshot => {
			let docId = null;
			snapshot.forEach(doc => {
				if (doc.exists) { docId = doc.id; }
			})
			return docId;
		});
	}

	// Contacts API will be used here...
	async function PromptPhoneNumber() {
		let phone = null;

		if ('contacts' in navigator) {
			const results = await navigator.contacts.select(['tel'], { multiple: false });
			phone = results[0].tel[0];
		} else {
			phone = prompt("Telefon Numarası");
		}

		// Remove Whitespace
		phone = phone.removeWhitespace();

		// Remove country section
		if (phone.startsWith("+")) {
			phone = phone.substring(3);
		}

		// Remove Leading 0
		if (phone.startsWith("0")) {
			phone = phone.substring(1);
		}

		return parseInt(phone);
	}

	function AddToGroup(userId, groupId) {
		const userDoc = usersCollection.doc(userId);
		const groupDoc = groupsCollection.doc(groupId);

		// Add group to the user
		userDoc.get().then(doc => {
			const data = doc.data();
			data.groups = [...new Set([...data.groups, groupId])];
			userDoc.set(data);
		});

		// Add user to the group
		groupDoc.get().then(doc => {
			const data = doc.data();
			data.users = [...new Set([...data.users, userId])];
			groupDoc.set(data);
		});
	}

	function InitializeFirebase() {
		const firebaseConfig = {
			apiKey: "AIzaSyAjK6t4sb4Ho07DO096ZzDJdlzWDCNbtRg",
			authDomain: "bchat0.firebaseapp.com",
			projectId: "bchat0",
			storageBucket: "bchat0.appspot.com",
			messagingSenderId: "305957742645",
			appId: "1:305957742645:web:0fd13f35aa98dc337ba97c",
			measurementId: "G-XR57101TSL"
		};
		firebase.initializeApp(firebaseConfig);
		firebase.analytics();

		db = firebase.firestore();
		auth = firebase.auth();
		auth.languageCode = 'tr';
	}
</script>

<div id="app">
	{#if uid}
		{#if focusedGroupId}
			<Chat
				bind:focusedGroupId
				bind:groups
				{ uid }
				{ PromptPhoneNumber }
				{ GetUIDOfPhone }
				{ AddToGroup }
			/>
		{:else}
			<Home
				bind:groups
				{ uid }
				{ PromptPhoneNumber }
				{ GetUIDOfPhone }
				{ AddToGroup }
			/>
		{/if}
	{:else}
		<Login />
	{/if}
</div>

<style>
	:root {
		--primary-color: #128c7e;
	}
	:global(*) {
		padding: 0;
		margin: 0;
		border: none;
		outline: none;
		text-decoration: none;
		box-sizing: border-box;
	}
	:global(header) {
		padding: 20px;
		height: 100px;
		color: white;
		background-color: var(--primary-color);
	}
	:global(main) {
		height: calc(100vh - 100px);
		overflow-y: scroll;
	}
</style>
