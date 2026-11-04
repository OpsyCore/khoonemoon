package app.khoonemoon.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** A separate, narrowly scoped device credential; never stores auth refresh tokens. */
final class BackgroundCredential {
    private static final String ALIAS = "khoonemoon-reminder-device-v1";
    private static final String PREFS = "reminder_background";
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private static String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
    }
    private static String decrypt(String encrypted) throws Exception {
        String[] parts = encrypted.split("\\.", -1);
        if (parts.length != 2) throw new IllegalArgumentException("invalid credential");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
    static synchronized JSONObject get(Context context) {
        try {
            String encrypted = prefs(context).getString("credential", null);
            return encrypted == null ? null : new JSONObject(decrypt(encrypted));
        } catch (Exception error) { return null; }
    }
    static synchronized JSONObject getOrCreate(Context context, String account) {
        if (account == null || !account.matches("[0-9a-fA-F-]{36}")) return null;
        try {
            JSONObject existing = get(context);
            if (existing != null && account.equals(existing.optString("account"))) return existing;
            byte[] random = new byte[32]; new SecureRandom().nextBytes(random);
            StringBuilder secret = new StringBuilder(64);
            for (byte value : random) secret.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
            JSONObject credential = new JSONObject().put("account", account).put("id", UUID.randomUUID().toString()).put("secret", secret.toString());
            if (!prefs(context).edit().putString("credential", encrypt(credential.toString())).commit()) return null;
            return credential;
        } catch (Exception error) { return null; }
    }
    static synchronized boolean isCurrent(Context context, String id, String account) {
        JSONObject current = get(context);
        return current != null && id.equals(current.optString("id")) && account.equals(current.optString("account"));
    }
    static synchronized void clear(Context context) { prefs(context).edit().clear().commit(); }
}
