import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { GoogleMap, Polyline, Marker } from '@react-google-maps/api';
import httpClient from '../utils/httpClient';
import { useWebSocket } from '../contexts/WebSocketContext';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
`;

const StatusContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`;

const StatusIndicator = styled.div<{ isConnected: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${props => props.isConnected ? '#4CAF50' : '#f44336'};
`;

const StatusText = styled.span`
  font-size: 14px;
  color: #666;
`;

const InputContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 200px;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #ff8c00;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    background-color: #ffa500;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
`;

const MapContainer = styled.div`
  flex-grow: 1;
  height: 600px;
`;

const FormSection = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FormTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-end;
`;

const StatusGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ApiStatus = styled.span<{ status: 'success' | 'error' | 'pending' | 'idle' }>`
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: ${props => {
    switch (props.status) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'pending': return '#ff9800';
      default: return '#757575';
    }
  }};
  color: white;
`;

const ResponsiveFormSection = styled(FormSection)`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ResponsiveButtonContainer = styled(ButtonContainer)`
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ResponsiveInputContainer = styled(InputContainer)`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

function BusManagement() {
  const { webSocket, connect } = useWebSocket();
  const [scheduleId, setScheduleId] = useState('');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isRouteLoaded, setIsRouteLoaded] = useState(false);
  const [routePath, setRoutePath] = useState<google.maps.LatLng[]>([]);
  const [busLocation, setBusLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [subscribeId, setSubscribeId] = useState('');
  const [unsubscribeId, setUnsubscribeId] = useState('');
  const [currentSubscribedId, setCurrentSubscribedId] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);

  const [apiStatus, setApiStatus] = useState<{
    route: { status: 'success' | 'error' | 'pending' | 'idle', code?: number };
    bus: { status: 'success' | 'error' | 'pending' | 'idle', code?: number };
    subscription: { status: 'success' | 'error' | 'pending' | 'idle', code?: number };
  }>({
    route: { status: 'idle' },
    bus: { status: 'idle' },
    subscription: { status: 'idle' }
  });

  const handleSearchRoute = async () => {
    try {
      if (polyline) {
        polyline.setMap(null);
        setPolyline(null);
      }

      setApiStatus(prev => ({ ...prev, route: { status: 'pending' } }));
      setRoutePath([]);
      setBusLocation(null);
      setIsRouteLoaded(false);

      const response = await httpClient.get(`/api/bus/path/${scheduleId}`);
      setApiStatus(prev => ({ ...prev, route: { status: 'success', code: response.status } }));
      
      const routePoints = response.data.points;
      setIsRouteLoaded(true);

      if (map && routePoints.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        const path = routePoints.map((point: { longitude: number; latitude: number }) => {
          const latLng = new google.maps.LatLng(point.latitude, point.longitude);
          bounds.extend(latLng);
          return latLng;
        });

        setRoutePath(path);
        
        const newPolyline = new google.maps.Polyline({
          path: path,
          strokeColor: '#0066ff',
          strokeOpacity: 1.0,
          strokeWeight: 5,
          map: map
        });
        
        setPolyline(newPolyline);
        map.fitBounds(bounds);
      }
    } catch (error: any) {
      setApiStatus(prev => ({ 
        ...prev, 
        route: { 
          status: 'error', 
          code: error.response?.status || 500 
        } 
      }));
      console.error('Error fetching route:', error);
    }
  };

  const handleStartBus = async () => {
    try {
      setApiStatus(prev => ({ ...prev, bus: { status: 'pending' } }));
      const response = await httpClient.post(`/api/admin/bus/${scheduleId}`, {
        'interval': 1,
        'delay': 0,
        'timeUnit': 'SECONDS',
      });
      setApiStatus(prev => ({ ...prev, bus: { status: 'success', code: response.status } }));
      console.log('Bus started successfully');
    } catch (error: any) {
      setApiStatus(prev => ({ 
        ...prev, 
        bus: { 
          status: 'error', 
          code: error.response?.status || 500 
        } 
      }));
      console.error('Error starting bus:', error);
    }
  };

  const handleStopBus = async () => {
    try {
      await httpClient.delete(`/api/admin/bus/${scheduleId}`)
        .then(() => {
          console.log('Bus stopped successfully');
          console.log('운행 종료: 구독 해제 시도');
          setCurrentSubscribedId(null);
          setBusLocation(null);
          handleClearRoute();
        });

    } catch (error) {
      console.error('Error stopping bus:', error);
    }
  };

  const handleClearRoute = () => {
    if (polyline) {
      polyline.setMap(null);
      setPolyline(null);
    }
    
    setRoutePath([]);
    setBusLocation(null);
    setIsRouteLoaded(false);
    setScheduleId('');
    
    if (map) {
      map.setZoom(15);
      map.setCenter({ lat: 37.5143, lng: 127.0319 });
    }
    
    setApiStatus(prev => ({
      ...prev,
      route: { status: 'idle' },
      bus: { status: 'idle' }
    }));
  };

  const handleSubscribe = async () => {
    if (!subscribeId) return;

    try {
      setApiStatus(prev => ({ ...prev, subscription: { status: 'pending' } }));

      // 새로운 구독 시작
      console.log('새로운 구독 시도:', subscribeId);
      const response = await httpClient.post(`/api/bus/subscription/${subscribeId}`);
      setCurrentSubscribedId(subscribeId);
      setApiStatus(prev => ({ 
        ...prev, 
        subscription: { status: 'success', code: response.status } 
      }));

    } catch (error: any) {
      console.error('구독 처리 중 오류:', error);
      setApiStatus(prev => ({ 
        ...prev, 
        subscription: { 
          status: 'error', 
          code: error.response?.status || 500 
        } 
      }));
    }
  };

  const handleUnsubscribe = async () => {
    if (!currentSubscribedId) return;

    try {
      setApiStatus(prev => ({ ...prev, subscription: { status: 'pending' } }));
      
      console.log('구독 해제 시도:', currentSubscribedId);
      await httpClient.delete(`/api/bus/subscription/${currentSubscribedId}`);
      setCurrentSubscribedId(null);
      setBusLocation(null);
      
      setApiStatus(prev => ({ 
        ...prev, 
        subscription: { status: 'success' } 
      }));
    } catch (error: any) {
      console.error('구독 해제 중 오류:', error);
      setApiStatus(prev => ({ 
        ...prev, 
        subscription: { 
          status: 'error', 
          code: error.response?.status || 500 
        } 
      }));
    }
  };

  useEffect(() => {
    if (webSocket instanceof WebSocket) {
      webSocket.binaryType = 'arraybuffer';
      
      const handleMessage = (message: MessageEvent) => {
        console.log('WebSocket 메시지 수신');
        try {
          const arrayBuffer = message.data;
          const dataView = new DataView(arrayBuffer);
          const longitude = dataView.getFloat64(0, false);
          const latitude = dataView.getFloat64(8, false);
          setBusLocation({ lat: latitude, lng: longitude });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;
      const baseDelay = 5000;

      const handleClose = () => {
        console.log('웹소켓 연결 끊김');
        if (currentSubscribedId && reconnectAttempts < maxReconnectAttempts) {
          const delay = baseDelay * Math.pow(2, reconnectAttempts);
          console.log(`재연결 시도 ${reconnectAttempts + 1}/${maxReconnectAttempts}, ${delay/1000}초 후 시도...`);
          
          setTimeout(() => {
            connect();
            reconnectAttempts++;
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('최대 재연결 시도 횟수 도달. 수동 재연결이 필요합니다.');
        }
      };

      webSocket.addEventListener("message", handleMessage);
      webSocket.addEventListener("close", handleClose);

      return () => {
        webSocket.removeEventListener("message", handleMessage);
        webSocket.removeEventListener("close", handleClose);
      };
    }
  }, [webSocket, currentSubscribedId, connect]);

  useEffect(() => {
    if (map && busLocation) {
      map.panTo(busLocation);
    }
  }, [busLocation, map]);

  useEffect(() => {
    // Cleanup function
    return () => {
      // 페이지를 떠날 때 구독 중이었다면 해제
      if (currentSubscribedId) {
        console.log('페이지 이탈: 구독 해제 시도:', currentSubscribedId);
        httpClient.delete(`/api/bus/subscription/${currentSubscribedId}`)
          .then(() => {
            console.log('구독 해제 완료');
          })
          .catch(error => {
            console.error('구독 해제 중 오류:', error);
          });
      }
    };
  }, [currentSubscribedId]);

  return (
    <Container>
      <StatusContainer>
        <StatusGroup>
          <StatusIndicator isConnected={!!webSocket} />
          <StatusText>
            {webSocket ? '웹소켓 연결됨' : '웹소켓 연결 끊김'}
          </StatusText>
          {!webSocket && (
            <Button onClick={connect}>재연결</Button>
          )}
        </StatusGroup>

        <StatusGroup>
          <StatusText>경로 조회:</StatusText>
          <ApiStatus status={apiStatus.route.status}>
            {apiStatus.route.status.toUpperCase()}
            {apiStatus.route.code && ` (${apiStatus.route.code})`}
          </ApiStatus>
        </StatusGroup>

        <StatusGroup>
          <StatusText>버스 제어:</StatusText>
          <ApiStatus status={apiStatus.bus.status}>
            {apiStatus.bus.status.toUpperCase()}
            {apiStatus.bus.code && ` (${apiStatus.bus.code})`}
          </ApiStatus>
        </StatusGroup>

        <StatusGroup>
          <StatusText>구독 상태:</StatusText>
          <ApiStatus status={apiStatus.subscription.status}>
            {apiStatus.subscription.status.toUpperCase()}
            {apiStatus.subscription.code && ` (${apiStatus.subscription.code})`}
          </ApiStatus>
        </StatusGroup>
      </StatusContainer>

      <ResponsiveFormSection>
        <FormGroup>
          <FormTitle>버스 경로 관리</FormTitle>
          <InputContainer>
            <Input
              type="text"
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              placeholder="버스 스케줄 ID 입력"
            />
            <ResponsiveButtonContainer>
              <Button onClick={handleSearchRoute}>경로 조회</Button>
              <Button 
                onClick={handleStartBus}
                disabled={!isRouteLoaded}
              >
                버스 출발
              </Button>
              <Button 
                onClick={handleStopBus}
                disabled={!isRouteLoaded}
              >
                버스 운행 종료
              </Button>
              <Button 
                onClick={handleClearRoute}
                disabled={!isRouteLoaded}
              >
                경로 초기화
              </Button>
            </ResponsiveButtonContainer>
          </InputContainer>
        </FormGroup>

        <FormGroup>
          <FormTitle>버스 위치 구독</FormTitle>
          <ResponsiveInputContainer>
            <Input
              type="text"
              value={subscribeId}
              onChange={(e) => setSubscribeId(e.target.value)}
              placeholder="구독할 버스 ID 입력"
              disabled={!!currentSubscribedId}
            />
            <Button 
              onClick={handleSubscribe}
              disabled={!subscribeId || !!currentSubscribedId}
            >
              구독
            </Button>
            <Button 
              onClick={handleUnsubscribe}
              disabled={!currentSubscribedId}
            >
              구독 해제
            </Button>
          </ResponsiveInputContainer>
        </FormGroup>
      </ResponsiveFormSection>

      <MapContainer>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 37.5143, lng: 127.0319 }}
          zoom={15}
          onLoad={setMap}
        >
          {busLocation && (
            <Marker
              position={busLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              title="버스 위치"
            />
          )}
        </GoogleMap>
      </MapContainer>
    </Container>
  );
}

export default BusManagement; 