export interface DeviceAuthorizationPreview {
  request_id: string;
  device_name: string;
  device_os: string;
  client_version: string;
  expires_at: string;
}

export interface ApproveDeviceAuthorizationRequest {
  request_id: string;
  user_code: string;
}
