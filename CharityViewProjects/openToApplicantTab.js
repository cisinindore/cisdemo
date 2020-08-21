import React, { Component, Fragment  } from 'react';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import {  Pagination } from 'react-bootstrap';
import { Bert } from 'meteor/themeteorchef:bert';
import AwatarReturn from '../../components/AwsImageDisplay';
import BackgroundReturn from '../../components/AwsCharityCoverImage';
import StyledTab from '../BrowseProject/style';
import Tabstyle from '../Tabs/style';
import './style.css'; 

class OpenToApplicants extends Component {
    constructor() {
      super();
      this.state = {
        myProjects: [],
        applicantsWindow: false,
        myOrganisation: [],
        openedTab: '1',
        openUserProfile: false,
        reviewWindwoOpen: false,
        feedBackWindowOpen: false,
        feedbackData: {},
        currentOffset: 1,
        reviewWorkVolunteerIdFro:0
      };
    }



  componentDidMount() {
    this.getActiveApplicantProjects();
  }

  /**
   * if a project is already assigned to a volunteer and that volunteer not activated the project
   * then when a charity admin click to check the applicant list, then this notification display to notify
   */
  displayNotification = () => {
    Bert.defaults = { hideDelay: 4000, style: 'fixed-top' };
    Bert.alert(
      'Already assigned to a volunteer, Volunteer has 2 weeks to active the project, after that you will get notification',
      'success',
    );
  };



  getActiveApplicantProjects = () => {
    Meteor.call('getCharityOpenToApplicantsProjects', (this.state.currentOffset), (error, response) => {
      if (!error) {
        this.setState({ myActiveProjects: response });
      }
    });

    Meteor.call('getCharityOpenToApplicantsProjectsLength', (error, response) => {
      if (!error) {
        this.setState({ myActiveProjectsLength: response });
      }
    });

  }

  renderNumbers = () => {
    let items = [];
    var totalPages = Math.ceil(this.state.myActiveProjectsLength / 4);
    for (let number = 1; number <= totalPages; number++) {
      items.push(
        <Pagination.Item key={number} onClick={() => this.handlePageNumber(number)} className={this.state.currentOffset === number ? 'activeclass' : 'pageItem'}> {number}</Pagination.Item>
      );
    }
    return items;
  }

  handlePageNumber(number) {
    this.setState({
      currentOffset: number
    }, () => {
      const countValue = this.state.currentOffset;
      Meteor.call('getCharityOpenToApplicantsProjects', countValue, (err, response) => {
        this.setState({ myActiveProjects: response });
      });
    });
  }

  handlePrevPage() {
    if (this.state.currentOffset > 1) {
      this.setState({
        currentOffset: this.state.currentOffset - 1
      }, () => {
        const countValue = this.state.currentOffset;
        Meteor.call('getCharityOpenToApplicantsProjects', countValue, (err, response) => {
          this.setState({ myActiveProjects: response });
        });
      });
    }
  }

  handleNextPage() {
    let numArray = this.renderNumbers()
    let finalPageCount = numArray.length;
    if (finalPageCount > this.state.currentOffset) {
      this.setState({
        currentOffset: this.state.currentOffset + 1
      }, () => {
        const countValue = this.state.currentOffset;
        Meteor.call('getCharityOpenToApplicantsProjects', countValue, (err, response) => {
          this.setState({ myActiveProjects: response });
        });
      });
    }
  }
 


   /**
   * This function reset the state redirect
   * the view to original listing layout
   */
  getBackToPage = () => {
    this.setState({ applicantsWindow: false });
    Meteor.call('getCharityProjects', (error, response) => {
      if (!error) {
        this.setState({ myProjects: response });
      }
    });
  };



  render(){
    const { handleApplicantsWindow, myOrganisation } = this.props;
    let projectCount = 0;
    

    return(
            <Fragment>
            { this.state.myActiveProjects !== undefined &&
                    this.state.myActiveProjects.map((data) => {


                    if (!data.workHistory && data.projectData.prStatus !== 'draft') {
                        let avatarImage = "";

                        {
                            myOrganisation !== undefined && myOrganisation.map((data1) => {

                            if (data1.coverImage) {

                            avatarImage = data1.coverImage;
                            }

                        })
                        }

                        projectCount += 1;

                        const date1 = new Date(data.projectData.deadline);

                        const dateString = `${date1.toLocaleDateString('en-US', {
                        day: 'numeric',
                        })} ${date1.toLocaleDateString('en-US', {
                        month: 'long',
                        })} ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;

    

                        let orgLogo = '';
                        let coverImage = '';
                        let templateTitle = '';
                        if (
                        myOrganisation !== undefined &&
                        myOrganisation[0] !== undefined
                        ) {
                        orgLogo = myOrganisation[0].avatar;
                        }

                        if (
                        myOrganisation !== undefined &&
                        myOrganisation[0] !== undefined &&
                        myOrganisation[0].coverImage !== undefined
                        ) {
                        coverImage = myOrganisation[0].coverImage;
                        }

                        if (data.templateInfo !== undefined && data.templateInfo[0] !== undefined) { templateTitle = data.templateInfo[0].templateTitle; }




                        let participantCnt = '';
                        if (data.appliedCount !== undefined && data.appliedCount > 0) {
                        participantCnt = '(' + data.appliedCount + ')';
                        }
                        let causesSend =
                        data.cause !== undefined && data.cause ? data.cause : '';
                        let skillSend =
                        data.skill !== undefined && data.skill ? data.skill : '';

                        return (
                        <Tabstyle.col50 className="col50" key={projectCount}>
                            <StyledTab.projectBox className="projectBox">
                            <StyledTab.projectBanner>
                                <StyledTab.BannerOverlay className="BannerOverlay">
                                { avatarImage !== undefined  ? <BackgroundReturn imagePath={avatarImage}/> : "" }
                                </StyledTab.BannerOverlay>

                                <StyledTab.BannerCaption>
                                <StyledTab.bannerLogo className="bannerLogo">

                                    {myOrganisation !== undefined &&
                                    myOrganisation[0] !== undefined ? (
                                      orgLogo !== undefined  ? <AwatarReturn avatarImage={orgLogo}/> : ""                  
                                    ) : (
                                        'NA'
                                    )}
                                </StyledTab.bannerLogo>

                                <StyledTab.projectlabelbox className="projectlabelbox">
                                    {data.cause !== undefined && data.cause ? (
                                    <StyledTab.projectlabel className="colorBagni">
                                        {data.cause.name}
                                    </StyledTab.projectlabel>
                                    ) : (
                                        ''
                                    )}

                                    {data.skill !== undefined && data.skill ? (
                                    <StyledTab.projectlabel2
                                        style={{ background: data.skill.color }}
                                    >
                                        {data.skill.name}
                                    </StyledTab.projectlabel2>
                                    ) : (
                                        ''
                                    )}
                                </StyledTab.projectlabelbox>
                                </StyledTab.BannerCaption>
                            </StyledTab.projectBanner>

                            <StyledTab.projectDetail className="projectDetail">
                                <StyledTab.projectHeading>
                                {data.projectData.title}
                                </StyledTab.projectHeading>



                                <div>
                                <p
                                    className="reponseText"
                                    style={{ paddingBottom: ' 0px' }}
                                >
                                    PROJECT DEADLINE:
                            </p>
                                <p className="hearDate">{dateString}</p>
                                </div>

                                <StyledTab.viewDetailBoxIn>
                                {data.isAssigned !== undefined && data.isAssigned ? (
                                    <StyledTab.btnPrimary className="assigned-block"
                                    onClick={() => this.displayNotification()}
                                    >
                                    Already assigned
                                </StyledTab.btnPrimary>
                                ) : (
                                    <StyledTab.btnPrimary
                                        onClick={() =>
                                        handleApplicantsWindow(
                                            data.projectData,
                                            orgLogo,
                                            coverImage,
                                            causesSend,
                                            skillSend,
                                            templateTitle

                                        )
                                        }
                                    >
                                        View Applicants {participantCnt}
                                    </StyledTab.btnPrimary>
                                    )}
                                </StyledTab.viewDetailBoxIn>
                            </StyledTab.projectDetail>


                            </StyledTab.projectBox>
                        </Tabstyle.col50>
                        );
                    }
                    return true;
                    })}

                    
                { 
                projectCount === 0 ? ( <h3 className="noProjectFound" style={{ textAlign: 'center' }}> No Project Found </h3> ) : ( "" )
                } 

                    
                 {(Math.ceil(this.state.myActiveProjectsLength / 4)) > 1 ?  
                <Pagination>
                    <Pagination.Prev onClick={() => this.handlePrevPage()} className={this.state.currentOffset === 1 ? 'disableLink pageNext' : 'pageNext'} />
                    {this.renderNumbers()}
                    <Pagination.Next onClick={() => this.handleNextPage()} className={this.state.currentOffset === Math.ceil(this.state.myActiveProjectsLength / 4) ? 'disableLink pageNext' : 'pageNext'} />
                </Pagination> : "" }

        </Fragment>                             
        )
  }

}

OpenToApplicants.propTypes = {
    history: PropTypes.object.isRequired,
  };
  export default OpenToApplicants;