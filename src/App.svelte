<script>
	import { toDate, formatDistanceToNow } from "date-fns";
	import { tr } from 'date-fns/locale'
	import { onMount } from 'svelte';

	let uid = "";
	const db = firebase.firestore();

	const auth = firebase.auth();
	auth.languageCode = 'tr';

	let groups = {};				// History of chats { groupId: { messages: { sentAt: { sendBy, text } } } }
	let userSubscription = null;	// Group subscriptions (call to unsubscribe)
	let groupSubscriptions = [];	// Chat subscriptions (call each to unsubscribe)
	
	let focusedGroupId = "";
	let messageToSend = "";

	let phoneInput = "";
	let codeInput = "";
	let phoneSent = false;
	let verificationNeeded = false;

	const usersCollection = db.collection("Users");
	const groupsCollection = db.collection("Groups");

	// When URL changes, update focusedGroupId
	window.addEventListener("hashchange", e => {
		const hash = window.location.hash.replace("#", "");
		const groupExists = Object.keys(groups).includes(hash)
		focusedGroupId = groupExists ? hash : "";
	})

	onMount(() => {
		window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('signIn', {
			'size': 'invisible',
			'callback': response => {
				console.log("Recaptcha Verifier Response: ", response);
			}
		});
	});

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

	async function SignIn() {
		let result = null;

		try {
			// User Sent The Phone Number, Show Loading Screen
			const phoneNumber = "+90" + phoneInput.split(" ").join("");
			phoneSent = true;

			// Server Received The Phone Number, Wait For The SMS Code
			result = await auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);
			verificationNeeded = true;
		} catch (err) {
			console.log(err);
		}

		window.confirmationResult = result;
	}

	function ConfirmSMS() {
		const code = codeInput.split(" ").join("");
		if (!window.confirmationResult) {
			return console.log("No window.confirmationResult! Error in signInWithPhoneNumber()");
		}
		window.confirmationResult.confirm(code)
			.then(() => { console.log("SMS Confirmed") })
			.catch(err => { console.log(err) })
	}

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
		const ref = groupsCollection.doc(groupId);

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
		const usersDoc = usersCollection.doc(userId);
		const groupDoc = groupsCollection.doc(groupId);

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

	async function LeaveGroup(groupId) {
		if (!confirm("Emin misiniz?")) { return }

		const user = await usersCollection.doc(uid).get();
		const data = doc.data();

		if (Object.keys(groups[groupId].users).length <= 2) {
			// Delete Group
			groupsCollection.doc(groupId).delete()
				.then(() => { console.log("Group Deleted Successfully!") })
				.catch(err => { console.error("Group Could Not Be Deleted!", error) });

			// Remove Group From It's Users
			const usersToUpdate = Object.keys(groups[groupId].users);

			for (const userId of usersToUpdate) {
				const ref = usersCollection.doc(userId);
				ref.get().then(doc => {
					const data = doc.data();
					data.groups = data.groups.filter(x => x != groupId);
					ref.set(data);
				});
			}
		}

		usersCollection.doc(uid).set(data);

		// Go back home
		focusedGroupId = "";
	}

	function CreateGroup(secondUserId) {
		// Empty Group Data Structure (Only initialize 'users')
		const data = { messages: {}, users: [ uid, secondUserId ] };

		// Add the 'data' to the firebase
		groupsCollection.add(data).then(docRef => {
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
	function GetUIDOfPhone(phone) {
		return db.collection("Users").where("tel", "==", phone).get().then(snapshot => {
			console.log(snapshot)
			let docId = null;
			snapshot.forEach(doc => {
				if (doc.exists) { docId = doc.id; }
			})
			return docId;
		});
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

	{#if uid}
		{#if focusedGroupId}
			<a href='/#'>Go Back</a>
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
			<button on:click={() => {auth.signOut()}}>Çıkış Yap</button>

			<hr />

			<div id="groups">
				{#each Object.entries(groups) as [groupId, group]}
					<a href={`#${groupId}`} class="linkToGroup">
						{Object.values(group.users)}
					</a>
				{/each}
			</div>
		{/if}
	{:else}
		{#if phoneSent && !verificationNeeded}
			Loading...
		{/if}

		{#if verificationNeeded}
			<input type="text" bind:value={codeInput} placeholder="xxx xxx" />
			<button id="verifySms" on:click={ConfirmSMS}>Verify</button>
		{:else}
			<input type="text" bind:value={phoneInput} placeholder="xxx xxx xx xx" />
			<button id="signIn" on:click={SignIn}>Sign In</button>
		{/if}
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
