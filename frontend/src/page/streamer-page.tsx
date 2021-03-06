import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
} from '@mui/material';
import { Box } from 'components/base/box';
import { Column } from 'components/base/column';
import { ConnectDialog } from 'components/connect-dialog';
import { PageLayout } from 'components/layout/page-layout';
import { StreamMetricsChips } from 'components/stream-metrics-chips';
import { SuperfluidConnected } from 'components/superfluid-connected';
import { VideoPlayer } from 'components/video-player';
import { useCreateStream, useGetStream, useGetStreams } from 'hooks/use-query-streams';
import { useUserAddress } from 'hooks/use-user-address';
import { useWindowSize } from 'hooks/use-window-size';
import { Event, EventType } from 'model/event-model';
import { Stream as StreamDBModel } from 'model/stream-model';
import Moralis from 'moralis';
import { SuperfluidWrapper, useSuperfluid } from 'provider/superfluid-provider';
import { isEmpty, isNil } from 'ramda';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { useMoralis } from 'react-moralis';
import { useRecoilState } from 'recoil';
import { Stream } from 'service/http/model/stream';
import styled from 'styled-components';
import { getAtom, StateKey } from 'utils/recoil';

interface ReceivedTip {
  fromAddress: string;
  value: number;
}

interface FormValues {
  title: string;
  fees: number;
}

export const StreamerPage: React.FunctionComponent = () => {
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const { isAuthenticated } = useMoralis();
  const userAddress = useUserAddress();
  const { isLoading: streamsAreLoading, data: streamsData } = useGetStreams();
  const createStreamMutation = useCreateStream();
  const sf: SuperfluidWrapper = useSuperfluid();
  const superfluidInitializedState = getAtom<boolean>(StateKey.SUPERFLUID_INITIALIZED);
  const [superfluidInitialized, setSuperfluidInitialized] = useRecoilState(
    superfluidInitializedState,
  );
  const [myStream, setMyStream] = useState<Stream | undefined>(undefined);
  const { data: streamData } = useGetStream(myStream?.id);
  const [receivedTip, setReceivedTip] = useState<ReceivedTip | undefined>(undefined);
  const [form, setForm] = useState<FormValues>({ title: '', fees: 0 });
  const [published, setPublished] = useState<boolean>(false);

  useEffect(() => {
    if (!isNil(myStream) && myStream.isActive) {
      const query = new Moralis.Query(Moralis.Object.extend('Stream'));
      query.equalTo('streamId', myStream!.id);
      query.find().then((results) => {
        if (!isEmpty(results)) {
          setPublished(true);
          setForm({ title: results[0].get('title'), fees: results[0].get('fees') });
        }
      });
    }
  }, [myStream]);

  useEffect((): void => {
    if (isAuthenticated && !superfluidInitialized) {
      // initialize Superfluid
      sf.initialize()
        .then(() => {
          setSuperfluidInitialized(true);
        })
        .catch((error) => {
          console.log(`Error initializing the Superfluid SDK: ${error}`);
          setSuperfluidInitialized(false);
        });
    }
  }, [isAuthenticated, superfluidInitialized]);

  // check for tips
  useEffect((): void => {
    if (isAuthenticated) {
      const query = new Moralis.Query('EthTokenTransfers');
      query.equalTo('to_address', userAddress);

      query.subscribe().then((subscription) =>
        subscription.on('create', (data) => {
          // @ts-ignore
          setReceivedTip({
            fromAddress: data.attributes.from_address,
            value: data.attributes.value / 10 ** 18,
          });
          const event = new Event();
          event.set('type', EventType.TIP);
          // @ts-ignore
          event.set('from', data.attributes.from_address);
          // @ts-ignore
          event.set('amount', data.attributes.value / 10 ** 18);
          event.set('to', userAddress);
          event
            .save()
            .catch((error: any) => console.error(`Error saving event to the DB: ${error}`));
        }),
      );
    }
  }, [isAuthenticated]);

  useEffect((): void => {
    if (isNil(myStream) && !streamsAreLoading) {
      const userStream = streamsData?.find((stream: Stream) => stream.name === userAddress);
      if (isNil(userStream)) {
        createStreamMutation.mutate(userAddress!);
      } else {
        setMyStream(userStream);
      }
    }
  }, [myStream, streamsAreLoading, streamsData]);

  useEffect((): void => {
    if (!createStreamMutation.isLoading && !isNil(createStreamMutation.data)) {
      setMyStream(createStreamMutation.data as unknown as Stream);
    }
  }, [createStreamMutation]);

  // query stream when window regains focus
  useEffect((): void => {
    if (!isNil(streamData)) {
      setMyStream(streamData);
    }
  }, [myStream, streamData]);

  const resetTip = useCallback(() => {
    setReceivedTip(undefined);
  }, [setReceivedTip]);

  const titleOnChange = (event: any) => {
    setForm((oldValue) => ({ ...oldValue, title: event.target.value }));
  };
  const tipOnChange = (event: any) => {
    let newValue = Number.parseInt(event.target.value);
    if (isNaN(newValue)) {
      newValue = 0;
    }
    setForm((oldValue) => ({ ...oldValue, fees: newValue }));
  };

  const publishStream = () => {
    if (!isNil(myStream)) {
      const streamDb = new StreamDBModel();
      streamDb.set('title', form.title);
      streamDb.set('streamId', myStream.id);
      streamDb.set('streamerAddress', userAddress);
      streamDb.set('fees', form.fees);
      streamDb
        .save()
        .then(() => setPublished(true))
        .catch((error) => {
          setPublished(false);
          console.error(`Error saving stream to DB: ${error}`);
        });
    }
    console.error(`Cannot save stream to DB: empty stream`);
  };

  return (
    <PageLayout>
      {isAuthenticated ? (
        <Box>
          <LeftSide>
            <VideoPlayer
              playbackId={myStream?.playbackId}
              active={myStream?.isActive}
              streamKey={myStream?.streamKey}
              autoplay={'play'}
            />
            <StreamInfoContainer>
              <StreamDetailsPaper>
                <StyledColumn>
                  <TitleTextField
                    color={'secondary'}
                    label="What are you streaming today?"
                    variant={'outlined'}
                    disabled={published}
                    onChange={titleOnChange}
                    value={form.title}
                  />
                  <FeesFormControl variant="outlined" color={'secondary'}>
                    <InputLabel htmlFor="fees-per-hour" color={'secondary'}>
                      $ per hour
                    </InputLabel>
                    <OutlinedInput
                      color={'secondary'}
                      id="fees-per-hour"
                      label="$ per hour"
                      disabled={published}
                      onChange={tipOnChange}
                      value={form.fees}
                      endAdornment={
                        <InputAdornment position="end">
                          <Tooltip
                            title={'All fees are paid in Dai. You are paid every second.'}
                            placement={'top'}
                          >
                            <InfoOutlinedIcon />
                          </Tooltip>
                        </InputAdornment>
                      }
                    />
                  </FeesFormControl>
                  <PublishButton
                    variant={'contained'}
                    color={'secondary'}
                    onClick={publishStream}
                    disabled={published}
                  >
                    Publish
                  </PublishButton>
                </StyledColumn>
              </StreamDetailsPaper>
              <LiveMetricsBox>
                <SuperfluidConnected>
                  <StreamMetricsChips />
                </SuperfluidConnected>
              </LiveMetricsBox>
            </StreamInfoContainer>
          </LeftSide>
        </Box>
      ) : (
        <ConnectDialog />
      )}
      <Snackbar open={!isNil(receivedTip)} autoHideDuration={10000} onClose={resetTip}>
        <Alert onClose={resetTip} severity="success" sx={{ width: '100%' }}>
          {`Received ${receivedTip?.value} dai from ${receivedTip?.fromAddress}`}
        </Alert>
      </Snackbar>
      {!isNil(receivedTip) && <Confetti width={windowWidth} height={windowHeight} />}
    </PageLayout>
  );
};

const LeftSide = styled(Column)`
  width: 1120px;
  height: 100%;
`;

const TitleTextField = styled(TextField)`
  && {
    width: 96%;
  }
`;

const FeesFormControl = styled(FormControl)`
  && {
    width: 36%;
  }
`;

const StreamInfoContainer = styled(Box)`
  margin-top: 32px;
  width: 1120px;
  > div:not(:first-child) {
    margin-left: 16px;
  }
`;

const StreamDetailsPaper = styled(Paper)`
  flex: 2;
  padding: 32px 16px;
`;

const StyledColumn = styled(Column)`
  > div:not(:first-child),
  button {
    margin-top: 16px;
  }
`;

const LiveMetricsBox = styled(Box)`
  flex: 1;
  justify-content: flex-end;
`;

const PublishButton = styled(Button)`
  && {
    width: 36%;
  }
`;
