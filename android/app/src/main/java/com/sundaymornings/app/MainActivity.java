package com.sundaymornings.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int REQUEST_MEDIA_PERMISSIONS = 1200;
    private static final int REQUEST_LOCATION_PERMISSIONS = 1201;

    private PermissionRequest pendingWebPermissionRequest;
    private GeolocationPermissions.Callback pendingGeolocationCallback;
    private String pendingGeolocationOrigin;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (bridge != null && bridge.getWebView() != null) {
            bridge
                .getWebView()
                .setWebChromeClient(
                    new BridgeWebChromeClient(bridge) {
                        @Override
                        public void onPermissionRequest(PermissionRequest request) {
                            runOnUiThread(() -> handleWebPermissionRequest(request));
                        }

                        @Override
                        public void onGeolocationPermissionsShowPrompt(
                            String origin,
                            GeolocationPermissions.Callback callback
                        ) {
                            runOnUiThread(() -> handleGeolocationPermissionRequest(origin, callback));
                        }
                    }
                );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == REQUEST_MEDIA_PERMISSIONS && pendingWebPermissionRequest != null) {
            if (allGranted(grantResults)) {
                pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
            } else {
                pendingWebPermissionRequest.deny();
            }
            pendingWebPermissionRequest = null;
            return;
        }

        if (requestCode == REQUEST_LOCATION_PERMISSIONS && pendingGeolocationCallback != null) {
            pendingGeolocationCallback.invoke(pendingGeolocationOrigin, allGranted(grantResults), false);
            pendingGeolocationCallback = null;
            pendingGeolocationOrigin = null;
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        List<String> requiredPermissions = new ArrayList<>();

        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                requiredPermissions.add(Manifest.permission.RECORD_AUDIO);
            }

            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                requiredPermissions.add(Manifest.permission.CAMERA);
            }
        }

        if (requiredPermissions.isEmpty()) {
            request.grant(request.getResources());
            return;
        }

        List<String> missingPermissions = getMissingPermissions(requiredPermissions);
        if (missingPermissions.isEmpty()) {
            request.grant(request.getResources());
            return;
        }

        pendingWebPermissionRequest = request;
        ActivityCompat.requestPermissions(this, missingPermissions.toArray(new String[0]), REQUEST_MEDIA_PERMISSIONS);
    }

    private void handleGeolocationPermissionRequest(String origin, GeolocationPermissions.Callback callback) {
        List<String> locationPermissions = new ArrayList<>();
        locationPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        locationPermissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);

        List<String> missingPermissions = getMissingPermissions(locationPermissions);
        if (missingPermissions.isEmpty()) {
            callback.invoke(origin, true, false);
            return;
        }

        pendingGeolocationOrigin = origin;
        pendingGeolocationCallback = callback;
        ActivityCompat.requestPermissions(this, missingPermissions.toArray(new String[0]), REQUEST_LOCATION_PERMISSIONS);
    }

    private List<String> getMissingPermissions(List<String> permissions) {
        List<String> missingPermissions = new ArrayList<>();
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                missingPermissions.add(permission);
            }
        }

        return missingPermissions;
    }

    private boolean allGranted(int[] grantResults) {
        if (grantResults.length == 0) {
            return false;
        }

        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }

        return true;
    }
}
