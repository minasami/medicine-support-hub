package com.medicinesupporthub.app

import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import io.appwrite.Client
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep Android SDK endpoint aligned with the JS client (custom domain).
        val client = Client(applicationContext)
            .setEndpoint("https://appwrite.medicinesupport.app/v1")
            .setProject("6a54ac3a00272c02d6e0")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                client.ping()
                Log.d("AppwriteSDK", "Appwrite Android SDK ping ok")
            } catch (e: Exception) {
                Log.w("AppwriteSDK", "Appwrite ping notice: ${e.message}")
            }
        }
    }
}
