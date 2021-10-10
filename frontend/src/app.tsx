import { Axios } from 'axios';
import { MainPage } from 'page/main-page';
import { StreamerPage } from 'page/streamer-page';
import { StreamPage } from 'page/stream-page';
import { HttpClientProvider } from 'provider/http-client-provider';
import { InjectedProviderProvider } from 'provider/injected-provider-provider';
import { LocalProviderProvider } from 'provider/local-provider-provider';
import { SuperfluidProvider } from 'provider/superfluid-provider';
import { Web3ModalProvider } from 'provider/web3modal-provider';
import React, { useMemo } from 'react';
import { MoralisProvider } from 'react-moralis';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Route, Switch } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { Routes } from 'service/routing';
import { NETWORKS } from 'utils/networks';

export const App: React.FunctionComponent = () => {
  const queryClient = useMemo(() => new QueryClient(), []);
  const httpClient = useMemo(
    () =>
      new Axios({
        baseURL: 'https://livepeer.com/api/',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_LIVEPEER_API_KEY}`,
        },
        transformResponse: (response) => JSON.parse(response),
      }),
    [],
  );
  return (
    <RecoilRoot>
      <MoralisProvider
        appId={process.env.REACT_APP_MORALIS_APP_ID!}
        serverUrl={process.env.REACT_APP_MORALIS_SERVER_URL!}
      >
        <LocalProviderProvider network={NETWORKS.localhost}>
          <InjectedProviderProvider>
            <Web3ModalProvider>
              <SuperfluidProvider>
                <HttpClientProvider client={httpClient}>
                  <QueryClientProvider client={queryClient}>
                    <Switch>
                      <Route path={Routes.viewStream} component={StreamPage} />
                      <Route path={Routes.stream} component={StreamerPage} />
                      <Route path={Routes.main} component={MainPage} />
                    </Switch>
                  </QueryClientProvider>
                </HttpClientProvider>
              </SuperfluidProvider>
            </Web3ModalProvider>
          </InjectedProviderProvider>
        </LocalProviderProvider>
      </MoralisProvider>
    </RecoilRoot>
  );
};
