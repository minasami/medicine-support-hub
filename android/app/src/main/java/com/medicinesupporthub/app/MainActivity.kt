package com.medicinesupporthub.app

import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import io.appwrite.Client
import io.appwrite.services.Account
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Appwrite Android SDK with applicationContext and Project details
        val client = Client(applicationContext)
            .setEndpoint("https://fra.cloud.appwrite.io/v1")
            .setProject("6a54ac3a00272c02d6e0")

        val account = Account(client)

        // Automatically ping Appwrite backend server on startup to verify connectivity
        CoroutineScope(Dispatchers.IO).launch {
            try {
                client.ping()
                Log.d("AppwriteSDK", "✓ Appwrite Android SDK connected and ping verified!")
            } catch (e: Exception) {
                Log.w("AppwriteSDK", "ℹ️ Appwrite ping notice: ${e.message}")
            }
        }
    }
}
