<script>
	import { onMount } from 'svelte';

	let phoneInput = "";
	let codeInput = "";
	let phoneSent = false;
	let verificationNeeded = false;

	// Format Phone Number (xxx-xxx-xx-xx)
	$: {
		if (phoneInput.startsWith(0)) {
			phoneInput = phoneInput.substring(1);
		}
		phoneInput = phoneInput.removeWhitespace();
		phoneInput = [
			phoneInput.substring(0, 3),
			phoneInput.substring(3, 6),
			phoneInput.substring(6, 8),
			phoneInput.substring(8, 10),
		].filter(x => !!x).join(" ");
	}

	// Format Verification Code (xxx-xxx)
	$: {
		codeInput = codeInput.removeWhitespace();
		codeInput = [
			codeInput.substring(0, 3),
			codeInput.substring(3, 6)
		].filter(x => !!x).join(" ");
	}

	onMount(() => {
		window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('signIn', {
			'size': 'invisible',
			'callback': response => { console.log("Recaptcha Verifier Response: ", response) }
		});
	});

	function ConfirmSMS() {
		const code = codeInput.removeWhitespace();

		if (window.confirmationResult) {
			window.confirmationResult.confirm(code)
				.then(() => { console.log("SMS Confirmed") })
				.catch(err => { console.log(err) })
		} else {
			console.log("No window.confirmationResult! Error in signInWithPhoneNumber()");
		}
	}

	async function SignIn() {
		let result = null;

		// User Sent The Phone Number, Show Loading Screen
		const phoneNumber = "+90" + phoneInput.removeWhitespace();
		phoneSent = true;

		// Server Received The Phone Number, Wait For The SMS Code
		result = await auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);
		verificationNeeded = true;

		window.confirmationResult = result;
	}
</script>

<header>bChat</header>

<main>
	{#if phoneSent && !verificationNeeded}
		<div id="loading">
			<h1>Mesaj Gönderiliyor</h1>
		</div>
	{/if}

	{#if verificationNeeded}
		<h3>Doğrulama Kodu</h3>
		<input type="text" bind:value={codeInput} placeholder="xxx xxx" />
		<button
			id="verifySms"
			on:click={ConfirmSMS}
			disabled={codeInput.removeWhitespace().length != 6}
		>Doğrula</button>
	{:else}
		<h3>Telefon Numarası</h3>
		<input type="text" bind:value={phoneInput} placeholder="xxx xxx xx xx" />
		<button
			id="signIn"
			on:click={SignIn}
			disabled={phoneInput.removeWhitespace().length != 10}
		>Giriş Yap</button>
	{/if}
</main>

<style>
	header {
		display: grid;
		place-items: center;
		font-size: 2em;
		font-weight: bold;
	}

	main {
		display: flex;
		flex-direction: column;
		justify-content: centeR;
		align-items: center;
	}

	input {
		width: 300px;
		max-width: 80%;
		padding: 10px 20px;
		font-size: 1.5em;
		border-radius: 5px;
		border: 2px solid #aaa;
		margin: 20px;
		text-align: center;
	}
	input:focus {
		border-color: var(--primary-color);
	}

	button {
		padding: 10px;
		color: white;
		border-radius: 5px;
		font-weight: 1.5em;
		background-color: #aaa;
	}
	button:not(:disabled) {
		background-color: var(--primary-color);
		cursor: pointer;
	}

	#loading {
		position: absolute;	
		top: 100px;
		bottom: 0;
		left: 0;
		right: 0;
		background: white;
		display: grid;
		place-items: center;
	}
	#loading h1 {
		font-size: 1.5em;
		color: #666;
	}
</style>
