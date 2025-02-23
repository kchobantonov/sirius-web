/*******************************************************************************
 * Copyright (c) 2019, 2021 Obeo.
 * This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *     Obeo - initial API and implementation
 *******************************************************************************/
import { useQuery } from '@apollo/client';
import {
  Representation,
  TreeItemContextMenuContribution,
  TreeItemType,
  Workbench,
} from '@eclipse-sirius/sirius-components';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import { useMachine } from '@xstate/react';
import gql from 'graphql-tag';
import { NavigationBar } from 'navigationBar/NavigationBar';
import { useEffect } from 'react';
import { generatePath, useHistory, useParams, useRouteMatch } from 'react-router-dom';
import { DocumentTreeItemContextMenuContribution } from 'views/edit-project/DocumentTreeItemContextMenuContribution';
import { EditProjectNavbar } from 'views/edit-project/EditProjectNavbar/EditProjectNavbar';
import {
  EditProjectViewParams,
  GQLGetProjectQueryData,
  GQLGetProjectQueryVariables,
} from 'views/edit-project/EditProjectView.types';
import {
  EditProjectViewContext,
  EditProjectViewEvent,
  editProjectViewMachine,
  HandleFetchedProjectEvent,
  HideToastEvent,
  SchemaValue,
  SelectRepresentationEvent,
  ShowToastEvent,
} from 'views/edit-project/EditProjectViewMachine';
import { ObjectTreeItemContextMenuContribution } from 'views/edit-project/ObjectTreeItemContextMenuContribution';

const getProjectQuery = gql`
  query getRepresentation($projectId: ID!, $representationId: ID!, $includeRepresentation: Boolean!) {
    viewer {
      project(projectId: $projectId) {
        id
        name
        currentEditingContext {
          id
          representation(representationId: $representationId) @include(if: $includeRepresentation) {
            id
            label
            kind
          }
        }
      }
    }
  }
`;

const useEditProjectViewStyles = makeStyles((theme) => ({
  editProjectView: {
    display: 'grid',
    gridTemplateRows: 'min-content minmax(0, 1fr)',
    gridTemplateColumns: '1fr',
    height: '100vh',
    width: '100vw',
  },
}));

export const EditProjectView = () => {
  const history = useHistory();
  const routeMatch = useRouteMatch();
  const { projectId, representationId } = useParams<EditProjectViewParams>();
  const classes = useEditProjectViewStyles();
  const [{ value, context }, dispatch] = useMachine<EditProjectViewContext, EditProjectViewEvent>(
    editProjectViewMachine
  );
  const { toast, editProjectView } = value as SchemaValue;
  const { project, representation, message } = context;

  const { loading, data, error } = useQuery<GQLGetProjectQueryData, GQLGetProjectQueryVariables>(getProjectQuery, {
    variables: {
      projectId,
      representationId: representationId ?? '',
      includeRepresentation: !!representationId,
    },
  });
  useEffect(() => {
    if (!loading) {
      if (error) {
        const showToastEvent: ShowToastEvent = {
          type: 'SHOW_TOAST',
          message: 'An unexpected error has occurred, please refresh the page',
        };
        dispatch(showToastEvent);
      }
      if (data) {
        const fetchProjectEvent: HandleFetchedProjectEvent = { type: 'HANDLE_FETCHED_PROJECT', data };
        dispatch(fetchProjectEvent);
      }
    }
  }, [loading, data, error, dispatch]);

  useEffect(() => {
    if (representation && representation.id !== representationId) {
      const pathname = generatePath(routeMatch.path, { projectId, representationId: representation.id });
      history.push({ pathname });
    } else if (editProjectView === 'loaded' && representation === null && representationId) {
      const pathname = generatePath(routeMatch.path, { projectId, representationId: null });
      history.push({ pathname });
    }
  }, [editProjectView, projectId, routeMatch, history, representation, representationId]);

  let main = null;
  if (editProjectView === 'loaded' && project) {
    const onRepresentationSelected = (representationSelected: Representation) => {
      const selectRepresentationEvent: SelectRepresentationEvent = {
        type: 'SELECT_REPRESENTATION',
        representation: representationSelected,
      };
      dispatch(selectRepresentationEvent);
    };

    main = (
      <Workbench
        editingContextId={project.currentEditingContext.id}
        initialRepresentationSelected={representation}
        onRepresentationSelected={onRepresentationSelected}
        readOnly={false}>
        <TreeItemContextMenuContribution
          canHandle={(item: TreeItemType) => item.kind === 'siriusWeb://document'}
          component={DocumentTreeItemContextMenuContribution}
        />
        <TreeItemContextMenuContribution
          canHandle={(item: TreeItemType) => item.kind.startsWith('siriusComponents://semantic')}
          component={ObjectTreeItemContextMenuContribution}
        />
      </Workbench>
    );
  } else if (editProjectView === 'missing') {
    main = (
      <Grid container justifyContent="center" alignItems="center">
        <Typography variant="h4" align="center" gutterBottom>
          The project does not exist
        </Typography>
      </Grid>
    );
  }

  let navbar = null;
  if (editProjectView === 'missing' || editProjectView === 'loading') {
    navbar = <NavigationBar />;
  } else if (editProjectView === 'loaded') {
    navbar = <EditProjectNavbar project={project} />;
  }

  return (
    <>
      <div className={classes.editProjectView}>
        {navbar}
        {main}
      </div>
      <Snackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        open={toast === 'visible'}
        autoHideDuration={3000}
        onClose={() => dispatch({ type: 'HIDE_TOAST' } as HideToastEvent)}
        message={message}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={() => dispatch({ type: 'HIDE_TOAST' } as HideToastEvent)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        data-testid="error"
      />
    </>
  );
};
