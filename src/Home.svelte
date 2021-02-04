<script>
	export let uid;

	export let groups;
	export let PromptPhoneNumber;
	export let GetUIDOfPhone;

	function AddToGroup(userId, groupId) {
		const usersDoc = db.collection("Users").doc(userId);
		const groupDoc = db.collection("Groups").doc(groupId);

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

	function CreateGroup(secondUserId) {
		// Empty Group Data Structure (Only initialize 'users')
		const data = { messages: {}, users: [ uid, secondUserId ] };

		// Add the 'data' to the firebase
		db.collection("Groups").add(data).then(docRef => {
			// Add yourself and the secondUser to the group
			AddToGroup(uid, docRef.id);
			AddToGroup(secondUserId, docRef.id);
		});
	}
</script>

<header>
	<h1>bChat</h1>
	<button id="logOut" on:click={() => {auth.signOut()}}>Çıkış Yap</button>
</header>

<button id="newChat" on:click={PromptToCreateGroup}>+</button>

<main>
	{#each Object.entries(groups) as [groupId, group]}
		<a href={`#${groupId}`} class="linkToGroup">
			{Object.values(group.users)}
		</a>

		<div class="seperator" />
	{/each}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-around;
	}
	#logOut {
		background: none;
		cursor: pointer;
		color: white;
		opacity: .75;
	}
	#logOut:hover { opacity: 1 }
	#newChat {
		width: 48px;
		height: 48px;
		right: 36px;
		bottom: 36px;

		background: var(--primary-color);
		border-radius: 100%;
		color: white;
		position: absolute;
		cursor: pointer;
	}

	main {
		display: flex;
		flex-direction: column;
	}
	.linkToGroup {
		padding: 20px 50px;
		margin: 0 50px;
		color: #132;
	}
	.seperator {
		width: calc(100% - 100px);
		height: 3px;
		align-self: center;

		border-radius: 10px;
		background: var(--primary-color);
		opacity: 0.2;
	}
</style>
